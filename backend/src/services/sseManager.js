const clients = new Map();

let nextId = 0;

export function addClient(userId, res) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  const client = { id: ++nextId, res };
  clients.get(userId).add(client);
  return client;
}

export function removeClient(userId, client) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  userClients.delete(client);
  if (userClients.size === 0) {
    clients.delete(userId);
  }
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [userId, userClients] of clients) {
    for (const client of userClients) {
      try {
        client.res.write(payload);
      } catch {
        removeClient(userId, client);
      }
    }
  }
}

export function broadcastToUser(targetUserId, event, data) {
  const userId = targetUserId?.toString();
  if (!userId) return;

  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) {
    return;
  }

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of userClients) {
    try {
      client.res.write(payload);
    } catch {
      removeClient(userId, client);
    }
  }
}

export function getConnectionCount() {
  let count = 0;
  for (const [, userClients] of clients) {
    count += userClients.size;
  }
  return count;
}
