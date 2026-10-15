import { render } from 'preact';
import '@fontsource-variable/fraunces/index.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import '@fontsource/atkinson-hyperlegible-next/800.css';
import './styles/global.css';
import './styles/game.css';
import './styles/screens.css';
import { App } from './app/App.tsx';

render(<App />, document.getElementById('app')!);
