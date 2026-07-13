import { createRoot } from 'react-dom/client';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('Landing page root element is missing.');
}

createRoot(rootElement).render(
  <main>
    <h1>GPT-Voice landing page</h1>
  </main>,
);
