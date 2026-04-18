type ServerSentEvent = {
  event: string;
  payload: Record<string, unknown>;
};

export type SseClient = {
  id: string;
  write: (chunk: string) => void;
  close: () => void;
};

class SseHub {
  private readonly clients = new Map<string, SseClient>();

  addClient(client: SseClient): void {
    this.clients.set(client.id, client);
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  broadcast(event: ServerSentEvent): void {
    const message = `event: ${event.event}\ndata: ${JSON.stringify(event.payload)}\n\n`;

    for (const client of this.clients.values()) {
      client.write(message);
    }
  }
}

export const sseHub = new SseHub();
