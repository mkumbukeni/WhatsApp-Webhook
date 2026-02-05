// session.ts - COMPLETE FIXED VERSION WITH SHOP OWNER SUPPORT
import { WhatsAppSession } from './types';

export class SessionManager {
  private sessions = new Map<string, WhatsAppSession>();

  getSession(phoneNumber: string): WhatsAppSession | undefined {
    return this.sessions.get(phoneNumber);
  }

  createSession(phoneNumber: string): WhatsAppSession {
    const session: WhatsAppSession = {
      phoneNumber,
      step: "idle",
      products: null,
      order: null,
      shopOwner: null,
    };
    this.sessions.set(phoneNumber, session);
    return session;
  }

  updateSession(phoneNumber: string, updates: Partial<WhatsAppSession>): WhatsAppSession | undefined {
    const session = this.getSession(phoneNumber);
    if (session) {
      Object.assign(session, updates);
    }
    return session;
  }

  resetSession(phoneNumber: string): WhatsAppSession | undefined {
    const session = this.getSession(phoneNumber);
    if (session) {
      session.step = "idle";
      session.products = null;
      session.order = null;
      session.shopOwner = null;
    }
    return session;
  }

  deleteSession(phoneNumber: string): boolean {
    return this.sessions.delete(phoneNumber);
  }

  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  // Optional: Add a method to clear all sessions
  clearAllSessions(): void {
    this.sessions.clear();
  }

  // Optional: Add a method to get session count by step
  getSessionsByStep(step: string): WhatsAppSession[] {
    const sessions: WhatsAppSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.step === step) {
        sessions.push(session);
      }
    }
    return sessions;
  }
}

export const sessionManager = new SessionManager();