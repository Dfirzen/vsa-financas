import os
import json
import time
import requests
import yfinance as yf
import sys

def get_base_path():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

# Cache path relative to the executable or script
CACHE_DIR = os.path.join(get_base_path(), 'data')
CACHE_FILE = os.path.join(CACHE_DIR, 'quotes_cache.json')

class MarketDataService:
    def __init__(self):
        if not os.path.exists(CACHE_DIR):
            os.makedirs(CACHE_DIR)
        self.cache: dict = self._load_cache()

    def _load_cache(self) -> dict:
        if not os.path.exists(CACHE_FILE):
            return {}
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading cache: {e}")
            return {}

    def _save_cache(self, data):
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"Error saving cache: {e}")

    def get_prices(self, tickers: list, force_refresh: bool = False):
        """
        Takes a list of tickers (e.g. ['PETR4', 'MXRF11']),
        fetches their latest prices, and caches them.
        Returns a dict of { 'PETR4': 35.50 }.
        """
        results = {}
        to_fetch = []
        
        # Check cache logic
        for ticker in tickers:
            cached_data = self.cache.get(ticker)
            if cached_data and not force_refresh:
                if time.time() - cached_data.get('timestamp', 0) < 900:
                    results[ticker] = cached_data['price']
                    continue
            to_fetch.append(ticker)
            
        if not to_fetch:
            return results
            
        for ticker in to_fetch:
            symbol = f"{ticker}.SA" if not ticker.endswith('.SA') else ticker
            try:
                stock = yf.Ticker(symbol)
                hist = stock.history(period="1d")
                if not hist.empty:
                    current_price = float(hist['Close'].iloc[-1])
                    results[ticker] = current_price
                    self.cache[ticker] = {
                        "price": current_price,
                        "timestamp": time.time()
                    }
                else:
                    if ticker in self.cache:
                        results[ticker] = self.cache[ticker]['price']
            except Exception as e:
                print(f"MarketDataService Error fetching {ticker}: {e}")
                if ticker in self.cache:
                    results[ticker] = self.cache[ticker]['price']
                    
        self._save_cache(self.cache)
        return results

    # ========== ÍNDICES DE MERCADO ==========

    def get_indices_history(self):
        """
        Returns monthly returns for CDI, IPCA, and major B3 indices.
        Returns dict keyed by index name, each value is a dict of YYYY-MM -> monthly return %.
        """
        cache_key = '__indices_history__'
        cached = self.cache.get(cache_key)
        if cached and time.time() - cached.get('timestamp', 0) < 86400:
            return cached['data']

        result = {}

        # CDI from BCB (series 4390 - CDI acumulado no mês %)
        result['CDI'] = self._fetch_bcb_series(4390)

        # IPCA from BCB (series 433 - Variação mensal %)
        result['IPCA'] = self._fetch_bcb_series(433)

        # B3 indices via yfinance
        yf_indices = {
            'IBOV': '^BVSP',
            'IFIX': 'IFIX.SA',
            'SMLL': 'SMAL11.SA',
            'IDIV': 'DIVO11.SA',
            'IVVB11': 'IVVB11.SA'
        }

        for name, ticker in yf_indices.items():
            result[name] = self._fetch_yf_monthly_returns(ticker)

        # Cache result
        self.cache[cache_key] = {'data': result, 'timestamp': time.time()}
        self._save_cache(self.cache)

        return result

    def _fetch_bcb_series(self, series_code):
        """Fetch a BCB time series and return dict keyed by YYYY-MM."""
        try:
            url = (
                f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_code}'
                f'/dados?formato=json&dataInicial=01/01/2024'
            )
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                result = {}
                for item in data:
                    parts = item['data'].split('/')
                    key = f"{parts[2]}-{parts[1]}"
                    result[key] = float(item['valor'])
                return result
        except Exception as e:
            print(f"Error fetching BCB series {series_code}: {e}")
        return {}

    def _fetch_yf_monthly_returns(self, ticker):
        """Fetch monthly returns from yfinance, return dict keyed by YYYY-MM."""
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="2y")
            if not hist.empty:
                # Build monthly close prices
                monthly_closes = {}
                for date, row in hist.iterrows():
                    key = f"{date.year}-{date.month:02d}"
                    monthly_closes[key] = float(row['Close'])

                # Calculate monthly returns
                sorted_months = sorted(monthly_closes.keys())
                result = {}
                for i in range(1, len(sorted_months)):
                    prev = monthly_closes[sorted_months[i - 1]]
                    curr = monthly_closes[sorted_months[i]]
                    if prev > 0:
                        pct = ((curr / prev) - 1) * 100
                        result[sorted_months[i]] = round(pct, 4)
                return result
        except Exception as e:
            print(f"Error fetching yfinance {ticker}: {e}")
        return {}

    # ========== PREÇOS MENSAIS HISTÓRICOS ==========

    def get_monthly_prices(self, tickers, period="2y"):
        """
        Get monthly closing prices for multiple tickers.
        Returns {ticker: {YYYY-MM: price}}.
        """
        results = {}
        to_fetch = []

        for ticker in tickers:
            cache_key = f"__monthly_{ticker}__"
            cached = self.cache.get(cache_key)
            if cached and time.time() - cached.get('timestamp', 0) < 86400:
                results[ticker] = cached['prices']
            else:
                to_fetch.append(ticker)

        for ticker in to_fetch:
            symbol = f"{ticker}.SA" if not ticker.endswith('.SA') else ticker
            try:
                stock = yf.Ticker(symbol)
                hist = stock.history(period=period)
                if not hist.empty:
                    prices = {}
                    for date, row in hist.iterrows():
                        key = f"{date.year}-{date.month:02d}"
                        prices[key] = round(float(row['Close']), 2)
                    results[ticker] = prices
                    self.cache[f"__monthly_{ticker}__"] = {
                        'prices': prices,
                        'timestamp': time.time()
                    }
            except Exception as e:
                print(f"Error fetching monthly history for {ticker}: {e}")

        if to_fetch:
            self._save_cache(self.cache)

        return results


# Singleton instance for the app to use
market_data_service = MarketDataService()
