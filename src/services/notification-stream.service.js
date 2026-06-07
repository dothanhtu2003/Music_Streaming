const clients = new Map();

const writeEvent = (res, eventName, data) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const removeClient = (userId, res) => {
  const userClients = clients.get(userId);

  if (!userClients) {
    return;
  }

  if (res.heartbeatInterval) {
    clearInterval(res.heartbeatInterval);
    res.heartbeatInterval = null;
  }

  userClients.delete(res);

  if (userClients.size === 0) {
    clients.delete(userId);
  }
};

const addClient = (userId, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }

  const userClients = clients.get(userId);
  userClients.add(res);

  writeEvent(res, "connected", {
    connected: true,
    time: new Date().toISOString(),
  });

  res.heartbeatInterval = setInterval(() => {
    try {
      writeEvent(res, "ping", {
        time: new Date().toISOString(),
      });
    } catch {
      removeClient(userId, res);
    }
  }, 25000);

  return () => {
    removeClient(userId, res);
  };
};

const sendToUser = (userId, notification) => {
  const userClients = clients.get(userId);

  if (!userClients || userClients.size === 0) {
    return;
  }

  for (const res of [...userClients]) {
    try {
      writeEvent(res, "notification", notification);
    } catch (error) {
      console.warn("SSE notification send failed:", error.message);
      removeClient(userId, res);
    }
  }
};

const getClientCount = () => {
  let count = 0;

  for (const userClients of clients.values()) {
    count += userClients.size;
  }

  return count;
};

module.exports = {
  addClient,
  removeClient,
  sendToUser,
  getClientCount,
};
