const MAX_EVENTS = 100;

export interface Event {
  name: string;
  result: string;
  status: "Success" | "Failure";
}

class EventerImpl {
  private events: Event[] = [];
  private listeners: ((line: Event) => void)[] = [];

  public submit(event: Event): void {
    this.append(event);
  }

  public getEvents(): readonly Event[] {
    return this.events;
  }

  public onAppend(cb: (event: Event) => void): void {
    this.listeners.push(cb);
  }

  private append(event: Event): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
    for (const cb of this.listeners) {
      cb(event);
    }
  }
}

export const Eventer = new EventerImpl();
