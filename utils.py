"""
Author: ByronVon
Date: 2025-01-04 12:32:50
FilePath: /ClaudeAnnualAnalysis/utils.py
Description: 
"""

import tiktoken
import json


def load_chat_data(file_path):
    """加载聊天数据文件"""
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_result(file_path, data):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def tokenize(text: str) -> list:
    encoding = tiktoken.get_encoding("o200k_base")
    return encoding.encode(text, disallowed_special=())
