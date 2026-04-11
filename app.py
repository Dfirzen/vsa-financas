import os
import sys
import json
import time
import threading
import webbrowser
from typing import Any
from flask import Flask, render_template, request, jsonify, send_file
from market_data_service import market_data_service
from ai_service import ai_service
from config_service import config_service

def get_base_path():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def get_resource_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

base_path = get_base_path()
res_path = get_resource_path()

app = Flask(__name__, 
            template_folder=os.path.join(res_path, 'templates'),
            static_folder=os.path.join(res_path, 'static'))

DATA_DIR = os.path.join(base_path, 'data')
METAS_FILE = os.path.join(DATA_DIR, 'metas.json')

# Define default metas
DEFAULT_METAS: list[dict[str, Any]] = [
    {
        "id": "renda_mensal",
        "title": "Renda Passiva Mensal",
        "icon": "💰",
        "value_current": 0,
        "value_target": 500,
        "status": "in_progress",
        "type": "currency"
    },
    {
        "id": "aporte_mensal",
        "title": "Aporte Mensal",
        "icon": "📈",
        "value_current": 0,
        "value_target": 1000,
        "status": "in_progress",
        "type": "currency"
    },
    {
        "id": "aporte_anual",
        "title": "Aporte no Ano",
        "icon": "📅",
        "value_current": 0,
        "value_target": 12000,
        "status": "in_progress",
        "type": "currency"
    },
    {
        "id": "patrimonio",
        "title": "Patrimônio Acumulado",
        "icon": "🏦",
        "value_current": 0,
        "value_target": 100000,
        "status": "in_progress",
        "type": "currency"
    }
]

def load_metas() -> list[dict[str, Any]]:
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    
    if not os.path.exists(METAS_FILE):
        with open(METAS_FILE, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_METAS, f, ensure_ascii=False, indent=4)
        return DEFAULT_METAS
    
    try:
        with open(METAS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading metas: {e}")
        return DEFAULT_METAS

def save_metas(metas_data):
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    with open(METAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(metas_data, f, ensure_ascii=False, indent=4)

# ==========================================
# Inicializar IA com config salva (se existir)
# ==========================================
def init_ai_from_config():
    cfg = config_service.get_config()
    if cfg.get('is_configured') and cfg.get('ai_api_key'):
        ai_service.configure(
            provider=cfg.get('ai_provider', 'gemini'),
            api_key=cfg.get('ai_api_key', ''),
            user_name=cfg.get('user_name', '')
        )

init_ai_from_config()

@app.route('/')
def index():
    return render_template('index.html')

# ==========================================
# CONFIG API
# ==========================================
@app.route('/api/config', methods=['GET'])
def get_config():
    cfg = config_service.get_config()
    # Mascarar a API key no GET (segurança)
    safe_cfg = dict(cfg)
    if safe_cfg.get('ai_api_key'):
        key = safe_cfg['ai_api_key']
        safe_cfg['ai_api_key_masked'] = key[:8] + '...' + key[-4:] if len(key) > 12 else '***'
        safe_cfg['ai_api_key'] = ''  # Não enviar a key completa
    return jsonify(safe_cfg)

@app.route('/api/config', methods=['POST'])
def save_config():
    data = request.get_json(silent=True) or {}
    
    # Se a API key veio vazia, manter a anterior
    current_cfg = config_service.get_config()
    if not data.get('ai_api_key') and current_cfg.get('ai_api_key'):
        data['ai_api_key'] = current_cfg['ai_api_key']
    
    data['is_configured'] = True
    
    success = config_service.save_config(data)
    
    if success:
        # Reconfigurar o serviço de IA com as novas configs
        ai_service.configure(
            provider=data.get('ai_provider', 'gemini'),
            api_key=data.get('ai_api_key', ''),
            user_name=data.get('user_name', '')
        )
    
    return jsonify({"status": "success" if success else "error"})

# ==========================================
# METAS API
# ==========================================
@app.route('/api/metas', methods=['GET'])
def get_metas():
    metas = load_metas()
    return jsonify(metas)

@app.route('/api/metas/<meta_id>', methods=['PUT', 'POST'])
def update_meta(meta_id):
    data = request.json
    metas = load_metas()
    updated_meta = None
    
    for meta in metas:
        if meta['id'] == meta_id:
            if 'title' in data:
                meta['title'] = data['title']
            if 'value_target' in data:
                meta['value_target'] = float(data['value_target'])
            if 'value_current' in data:
                meta['value_current'] = float(data['value_current'])
            if 'icon' in data:
                meta['icon'] = data['icon']
            updated_meta = meta
            break
            
    # Auto-calculate anual if mensal is updated
    if meta_id == 'aporte_mensal' and 'value_target' in data:
        for m in metas:
            if m['id'] == 'aporte_anual':
                m['value_target'] = float(data['value_target']) * 12
    
    save_metas(metas)
    return jsonify({"status": "success", "meta": updated_meta})

@app.route('/api/metas', methods=['POST'])
def create_meta():
    data = request.json
    metas = load_metas()
    
    new_meta = {
        "id": data.get('id', f"custom_{int(time.time())}"),
        "title": data.get('title', 'Nova Meta'),
        "icon": data.get('icon', '🎯'),
        "value_current": float(data.get('value_current', 0)),
        "value_target": float(data.get('value_target', 1000)),
        "status": "in_progress",
        "type": data.get('type', 'currency')
    }
    
    metas.append(new_meta)
    save_metas(metas)
    return jsonify({"status": "success", "meta": new_meta})

@app.route('/api/metas/<meta_id>', methods=['DELETE'])
def delete_meta(meta_id):
    metas = load_metas()
    metas = [m for m in metas if m['id'] != meta_id]
    save_metas(metas)
    return jsonify({"status": "success"})

# ==========================================
# EXTRATO API
# ==========================================
@app.route('/api/extrato/file', methods=['GET'])
def get_extrato_file():
    # Primeiro, tenta o caminho configurado pelo usuário
    cfg = config_service.get_config()
    configured_path = cfg.get('excel_path', '')
    
    if configured_path and os.path.exists(configured_path):
        return send_file(configured_path, as_attachment=True)
    
    # Fallback: arquivo local na mesma pasta do executável
    excel_path = os.path.join(base_path, 'Extrato.xlsx')
    if os.path.exists(excel_path):
        return send_file(excel_path, as_attachment=True)
    
    return jsonify({"error": "File not found"}), 404

# ==========================================
# MARKET DATA API
# ==========================================
@app.route('/api/quotes', methods=['POST'])
def get_quotes():
    data = request.get_json(silent=True) or {}
    tickers = data.get('tickers', [])
    force_refresh = data.get('force', False)
    
    if not tickers:
        return jsonify({})
        
    prices = market_data_service.get_prices(tickers, force_refresh)
    return jsonify(prices)

@app.route('/api/indices', methods=['GET'])
def get_indices():
    """Returns monthly returns for CDI, IPCA, IBOV, IFIX, SMLL, IDIV, IVVB11."""
    data = market_data_service.get_indices_history()
    return jsonify(data)

@app.route('/api/monthly-prices', methods=['POST'])
def get_monthly_prices():
    """Returns monthly closing prices for given tickers (for TWR calculation)."""
    data = request.get_json(silent=True) or {}
    tickers = data.get('tickers', [])
    period = data.get('period', '2y')
    if not tickers:
        return jsonify({})
    prices = market_data_service.get_monthly_prices(tickers, period)
    return jsonify(prices)

# ==========================================
# AI API
# ==========================================
@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    """Check if AI is configured."""
    return jsonify({"configured": ai_service.is_configured()})

@app.route('/api/ai/analyze', methods=['POST'])
def ai_analyze():
    """Generate automatic portfolio analysis."""
    data = request.get_json(silent=True) or {}
    result = ai_service.analyze_portfolio(data)
    return jsonify(result)

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    """Chat with the AI about the portfolio."""
    data = request.get_json(silent=True) or {}
    session_id = data.get('session_id', 'default')
    message = data.get('message', '')
    portfolio_data = data.get('portfolio_data', None)
    
    if not message:
        return jsonify({"error": "Message is required"})
    
    result = ai_service.chat(session_id, message, portfolio_data)
    return jsonify(result)

def open_browser():
    time.sleep(1.5)
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    threading.Thread(target=open_browser, daemon=True).start()
    # Usar debug=False para evitar que reinicie a thread ou crie problemas ao ser executado empacotado.
    app.run(debug=False, port=5000)
