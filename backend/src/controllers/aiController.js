import * as aiService from '../services/aiService.js';
import * as aiPersonaService from '../services/aiPersonaService.js';

const activeAIRequests = new Map();

function createRequestAbortSignal(req, res) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      console.log('[ai] request abort signal triggered');
      controller.abort();
    }
  };
  const handleResponseClose = () => {
    if (!res.writableEnded) {
      console.log('[ai] response closed before stream finished');
      abort();
    }
  };

  req.on('aborted', abort);
  res.on('close', handleResponseClose);

  return {
    signal: controller.signal,
    abort,
    cleanup: () => {
      req.off('aborted', abort);
      res.off('close', handleResponseClose);
    },
  };
}

export const sendMessage = async (req, res) => {
  const { sessionId, message, context, requestId } = req.body;
  const { signal, abort, cleanup } = createRequestAbortSignal(req, res);
  const requestKey = requestId ? `${req.user.id}:${requestId}` : null;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const emitEvent = (str) => {
    if (!signal.aborted && res.writable && !res.writableEnded) res.write(str);
  };

  try {
    if (requestKey) {
      activeAIRequests.set(requestKey, {
        abort: () => {
          console.log('[ai] server-side cancel requested:', requestKey);
          abort();
        },
      });
    }
    await aiService.sendMessage(req.user.id, sessionId, message, { signal, emitEvent, context });
  } catch (error) {
    if (!signal.aborted && !res.writableEnded) {
      const { sseError } = await import('../services/llm/sseEvents.js');
      res.write(sseError(error.isOperational ? error.message : '服务暂时不可用'));
    }
  } finally {
    if (requestKey) {
      activeAIRequests.delete(requestKey);
    }
    if (!signal.aborted && !res.writableEnded) res.end();
    cleanup();
  }
};

export const regenerateMessage = async (req, res) => {
  const { id } = req.params;
  const { requestId } = req.body || {};
  const { signal, abort, cleanup } = createRequestAbortSignal(req, res);
  const requestKey = requestId ? `${req.user.id}:${requestId}` : null;

  if (requestKey) {
    activeAIRequests.set(requestKey, {
      abort: () => {
        console.log('[ai] server-side cancel requested:', requestKey);
        abort();
      },
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const emitEvent = (str) => {
    if (!signal.aborted && res.writable && !res.writableEnded) res.write(str);
  };

  try {
    await aiService.regenerateMessage(req.user.id, id, { signal, emitEvent });
  } catch (error) {
    if (!signal.aborted && !res.writableEnded) {
      const { sseError } = await import('../services/llm/sseEvents.js');
      res.write(sseError(error.isOperational ? error.message : '服务暂时不可用'));
    }
  } finally {
    if (requestKey) {
      activeAIRequests.delete(requestKey);
    }
    if (!signal.aborted && !res.writableEnded) res.end();
    cleanup();
  }
};

export const cancelRequest = async (req, res) => {
  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ success: false, error: '缺少 requestId' });
  }

  const requestKey = `${req.user.id}:${requestId}`;
  const activeRequest = activeAIRequests.get(requestKey);
  if (!activeRequest) {
    return res.json({ success: true, cancelled: false });
  }

  activeRequest.abort();
  return res.json({ success: true, cancelled: true });
};

export const getSessions = async (req, res) => {
  const result = await aiService.getSessions(req.user.id);
  res.json({ success: true, data: { sessions: result } });
};

export const getSession = async (req, res) => {
  const { id } = req.params;
  const result = await aiService.getSession(req.user.id, id);
  res.json({ success: true, data: result });
};

export const createSession = async (req, res) => {
  const result = await aiService.createSession(req.user.id);
  res.status(201).json({ success: true, data: result });
};

export const deleteSession = async (req, res) => {
  const { id } = req.params;
  await aiService.deleteSession(req.user.id, id);
  res.json({ success: true });
};

export const getProfile = async (req, res) => {
  const result = await aiPersonaService.getProfile(req.user.id);
  res.json({ success: true, data: result });
};

export const updateProfile = async (req, res) => {
  const result = await aiPersonaService.updateProfile(req.user.id, req.body?.persona ?? req.body);
  res.json({ success: true, data: result });
};

export const getSessionPersona = async (req, res) => {
  const { id } = req.params;
  const result = await aiPersonaService.getSessionPersona(req.user.id, id);
  res.json({ success: true, data: result });
};

export const updateSessionPersona = async (req, res) => {
  const { id } = req.params;
  const result = await aiPersonaService.updateSessionPersona(req.user.id, id, req.body?.persona ?? req.body);
  res.json({ success: true, data: result });
};
