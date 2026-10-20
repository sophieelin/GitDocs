import { MongoServerError, type Collection, type Db } from "mongodb";

export interface Reservation {
  _id: string;
  user: string;
  resource: string;
  claimed: boolean;
}

export class Reserving {
  private readonly reservations: Collection<Reservation>;
  private readonly ready: Promise<string>;

  constructor(db: Db) {
    this.reservations = db.collection<Reservation>("reserving.reservations");
    // The unique index stops a resource from being reserved twice.
    this.ready = this.reservations.createIndex({ resource: 1 }, { unique: true });
  }

  async reserve(user: string, resource: string): Promise<string> {
    await this.ready;
    const reservation: Reservation = { _id: crypto.randomUUID(), user, resource, claimed: false };
    try {
      await this.reservations.insertOne(reservation);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new Error(`${resource} is already reserved`);
      }
      throw error;
    }
    return reservation._id;
  }

  async claim(id: string): Promise<void> {
    const result = await this.reservations.updateOne({ _id: id, claimed: false }, { $set: { claimed: true } });
    if (result.matchedCount === 0) {
      throw new Error("No unclaimed reservation with that id");
    }
  }

  async cancel(id: string): Promise<void> {
    const result = await this.reservations.deleteOne({ _id: id, claimed: false });
    if (result.deletedCount === 0) {
      throw new Error("No unclaimed reservation with that id");
    }
  }

  async forUser(user: string): Promise<Reservation[]> {
    return this.reservations.find({ user }).toArray();
  }
}
