import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { todoConv, type Todo } from './converter';

export async function addTodo(title: string) {
  const todosCol = collection(db, 'todos').withConverter<Todo>(todoConv);
  await addDoc(todosCol, { title, done: false, ts: Date.now() });
}

export async function getIncompleteTodos(): Promise<Todo[]> {
  const todosCol = collection(db, 'todos').withConverter<Todo>(todoConv);
  const qs = await getDocs(query(todosCol, where('done', '==', false)));
  return qs.docs.map(d => d.data());
}
