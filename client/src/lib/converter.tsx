import { type FirestoreDataConverter, Timestamp } from 'firebase/firestore';

export type Todo = { title: string; done: boolean; ts: number }; // keep it plain

export const todoConv: FirestoreDataConverter<Todo> = {
  toFirestore: (t) => t,
  fromFirestore: (snap, _opts) => {
    const d = snap.data() as any;
    return { title: d.title, done: d.done, ts: typeof d.ts === 'number' ? d.ts : (d.ts as Timestamp).toMillis() };
  },
};
