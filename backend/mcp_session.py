"""
Persistent MCP Session Manager (Per-User).

Manages per-user sessions to the Fi Money MCP server so that each user's
authentication and data are isolated. Sessions are automatically cleaned
up after a configurable idle timeout.
"""
import asyncio
import logging
import os
import time
from fi_finance_agent import streamablehttp_client, ClientSession

logger = logging.getLogger("mcp_session")

FI_SERVER_URL = os.environ.get("FI_SERVER_URL", "https://mcp.fi.money:8080/mcp/stream")

# Session idle timeout in seconds (default: 15 minutes)
SESSION_IDLE_TIMEOUT = int(os.environ.get("MCP_SESSION_TIMEOUT", "900"))


class MCPUserSession:
    """Manages a single MCP connection for one user."""

    def __init__(self, uid: str):
        self.uid = uid
        self._session = None
        self._read_stream = None
        self._write_stream = None
        self._context = None
        self._session_context = None
        self._connected = False
        self._last_used = time.time()
        self._lock = asyncio.Lock()

    @property
    def is_connected(self):
        return self._connected and self._session is not None

    @property
    def is_expired(self):
        return (time.time() - self._last_used) > SESSION_IDLE_TIMEOUT

    def _touch(self):
        """Update last-used timestamp."""
        self._last_used = time.time()

    async def connect(self):
        """Establish a persistent MCP connection for this user."""
        async with self._lock:
            if self._connected:
                self._touch()
                return True

            try:
                logger.info(f"Opening MCP connection for user {self.uid[:8]}...")

                self._context = streamablehttp_client(FI_SERVER_URL)
                streams = await self._context.__aenter__()
                self._read_stream, self._write_stream, _ = streams

                self._session_context = ClientSession(self._read_stream, self._write_stream)
                self._session = await self._session_context.__aenter__()
                await self._session.initialize()

                self._connected = True
                self._touch()
                logger.info(f"MCP connection established for user {self.uid[:8]}")
                return True

            except Exception as e:
                logger.error(f"Failed to connect MCP for user {self.uid[:8]}: {e}")
                await self._cleanup()
                return False

    async def disconnect(self):
        """Close the MCP connection."""
        async with self._lock:
            await self._cleanup()

    async def _cleanup(self):
        """Clean up connection resources."""
        self._connected = False
        try:
            if self._session_context:
                await self._session_context.__aexit__(None, None, None)
        except Exception:
            pass
        try:
            if self._context:
                await self._context.__aexit__(None, None, None)
        except Exception:
            pass
        self._session = None
        self._session_context = None
        self._context = None
        self._read_stream = None
        self._write_stream = None

    async def call_tool(self, tool_name: str, arguments: dict = None, timeout: float = 30.0):
        """Call an MCP tool, reconnecting if needed."""
        if not self._connected:
            connected = await self.connect()
            if not connected:
                raise Exception("Cannot connect to Fi Money MCP server")

        try:
            self._touch()
            result = await asyncio.wait_for(
                self._session.call_tool(tool_name, arguments or {}),
                timeout=timeout,
            )
            return result
        except Exception as e:
            logger.error(f"Tool call failed for user {self.uid[:8]}: {e}")
            await self._cleanup()
            raise

    async def check_auth(self):
        """Check if the MCP session is authenticated."""
        try:
            result = await self.call_tool("fetch_net_worth", {}, timeout=15.0)
            text = result.content[0].text

            if "wealth-mcp-login" in text or "login" in text.lower():
                return {"authenticated": False, "message": text}
            return {"authenticated": True, "message": "Connected"}
        except Exception as e:
            return {"authenticated": False, "message": str(e)}


class MCPSessionPool:
    """Manages per-user MCP sessions with automatic cleanup."""

    def __init__(self):
        self._sessions: dict[str, MCPUserSession] = {}
        self._lock = asyncio.Lock()
        self._cleanup_task = None

    def get_session(self, uid: str) -> MCPUserSession:
        """Get or create a session for a specific user."""
        if uid not in self._sessions:
            self._sessions[uid] = MCPUserSession(uid)
            logger.info(f"Created new MCP session for user {uid[:8]}, pool size: {len(self._sessions)}")
        return self._sessions[uid]

    async def cleanup_expired(self):
        """Remove expired sessions."""
        async with self._lock:
            expired_uids = [
                uid for uid, session in self._sessions.items()
                if session.is_expired
            ]
            for uid in expired_uids:
                logger.info(f"Cleaning up expired session for user {uid[:8]}")
                await self._sessions[uid].disconnect()
                del self._sessions[uid]

    async def start_cleanup_loop(self):
        """Start a background task that periodically cleans up expired sessions."""
        async def _loop():
            while True:
                await asyncio.sleep(60)  # Check every 60 seconds
                await self.cleanup_expired()

        self._cleanup_task = asyncio.create_task(_loop())

    async def disconnect_all(self):
        """Disconnect all sessions (for graceful shutdown)."""
        for session in self._sessions.values():
            await session.disconnect()
        self._sessions.clear()


# Global session pool — each user gets their own session
mcp_pool = MCPSessionPool()

# Backward-compatible alias for existing code
# (mcp_manager is replaced by per-user sessions via mcp_pool)
mcp_manager = mcp_pool
