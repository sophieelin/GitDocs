import type { Collection, Db } from "mongodb";

export class UnknownSession extends Error {}

type SessionDoc = { _id: string; subject: string; expiresAt: Date };

const SESSION_LIFETIME_MS = 30 * 60 * 1000;

/** Keeps short-lived opaque sessions. Ported from the sync-engine message-board example to MongoDB. */
export class SessioningConcept {
  private readonly sessions: Collection<SessionDoc>;

  constructor(
    db: Db,
    private readonly clock: () => Date = () => new Date(),
    private readonly freshSession: () => string = () => crypto.randomUUID(),
  ) {
    this.sessions = db.collection<SessionDoc>("Sessioning.sessions");
  }

  async start({ subject }: { subject: string }) {
    const now = this.clock();
    await this.sessions.deleteMany({ expiresAt: { $lte: now } });
    const session = this.freshSession();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    await this.sessions.insertOne({ _id: session, subject, expiresAt });
    return { session, expiresAt };
  }

  async current({ session }: { session: string }) {
    const found = await this.sessions.findOne({ _id: session });
    if (found === null) throw new UnknownSession("This session is not active.");
    if (found.expiresAt <= this.clock()) {
      await this.sessions.deleteOne({ _id: session });
      throw new UnknownSession("This session is not active.");
    }
    return { subject: found.subject };
  }

  async end({ session }: { session: string }) {
    // One atomic delete, so ending the same session twice at once cannot succeed twice.
    const ended = await this.sessions.findOneAndDelete({ _id: session, expiresAt: { $gt: this.clock() } });
    if (ended === null) {
      await this.sessions.deleteOne({ _id: session });
      throw new UnknownSession("This session is not active.");
    }
    return { ended: true };
  }

  async _active({ session }: { session: string }): Promise<Array<{ subject: string; expiresAt: Date }>> {
    const found = await this.sessions.findOne({ _id: session, expiresAt: { $gt: this.clock() } });
    return found === null ? [] : [{ subject: found.subject, expiresAt: found.expiresAt }];
  }
}
