import os
import json
import sys

def get_base_path():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

# O arquivo de configuração vai morar em data/config.json resolvido pelo base_path
CONFIG_DIR = os.path.join(get_base_path(), 'data')
CONFIG_FILE = os.path.join(CONFIG_DIR, 'config.json')

class ConfigService:
    def __init__(self):
        if not os.path.exists(CONFIG_DIR):
            os.makedirs(CONFIG_DIR)
        
        self.default_config = {
            "is_configured": False,
            "user_name": "",
            "excel_path": "",
            "ai_provider": "gemini",
            "ai_api_key": ""
        }
        self.config = self._load()

    def _load(self):
        if not os.path.exists(CONFIG_FILE):
            return self.default_config.copy()
        
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
                # Merge with default config to ensure all keys exist
                final_config = self.default_config.copy()
                final_config.update(data)
                return final_config
                
        except Exception as e:
            print(f"Error loading config.json: {e}")
            return self.default_config.copy()

    def get_config(self):
        return self.config

    def save_config(self, new_config):
        # Update current in-memory config
        self.config.update({
            "is_configured": new_config.get("is_configured", True),
            "user_name": new_config.get("user_name", self.config["user_name"]),
            "excel_path": new_config.get("excel_path", self.config["excel_path"]),
            "ai_provider": new_config.get("ai_provider", self.config["ai_provider"]),
            "ai_api_key": new_config.get("ai_api_key", self.config["ai_api_key"])
        })
        
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=4)
            return True
        except Exception as e:
            print(f"Error saving config.json: {e}")
            return False

# Export singleton
config_service = ConfigService()
