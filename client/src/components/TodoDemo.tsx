import React, { useEffect, useState } from 'react';
import { addTodo, getIncompleteTodos } from '../lib/todos';

export default function TodoDemo() {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<Array<{ title: string; done: boolean; ts: number }>>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const t = await getIncompleteTodos();
      setItems(t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    await addTodo(title);
    setTitle('');
    await load();
  }

  return (
    <div>
      <h3>Todos demo</h3>
      <form onSubmit={onAdd}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="New todo" />
        <button type="submit">Add</button>
      </form>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {items.map((it) => (
            <li key={it.ts}>{it.title} {it.done ? '✓' : ''}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
