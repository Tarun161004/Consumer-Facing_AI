import asyncio
import json
import os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from rich.console import Console

console = Console()
SESSION_FILE = "mcp_session.json"

def save_mcp_session(headers):
    """Saves authentication headers locally so you don't have to log in every time."""
    try:
        # We clean the headers to ensure they are valid JSON
        serializable = {str(k): str(v) for k, v in headers.items()}
        with open(SESSION_FILE, "w") as f:
            json.dump(serializable, f)
        return True
    except Exception as e:
        console.print(f"[yellow]⚠️ Could not save session: {e}[/yellow]")
        return False

def load_mcp_session():
    """Checks for an existing session file and returns the headers."""
    if os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            return None
    return None

# Exporting for the orchestrator
__all__ = ['streamablehttp_client', 'ClientSession', 'save_mcp_session', 'load_mcp_session']
