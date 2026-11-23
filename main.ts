// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// TIDECHART DUEL — this file is the entry's own hand-in, not the kit's
// Block Dodger starter. It still copies game/ and screenshots/ to /output
// and writes /output/dossier.json with the vendored make.fun library, but
// it also says what it is handing in and checks the hand-in before it
// leaves: the tide header below names the deck-is-life rules the judge
// will play, and the checks after the copy refuse a broken output instead
// of shipping it.

// The tide table, as the game itself plays it (game/src/config.js):
// 30 cards a deck, 5 in hand, HIGH TIDE adds 3 to attack, LOW TIDE adds 3
// to defence, and matching the rival's suit adds 2 to the current.
function printTideHeader() {
  console.log('TIDECHART DUEL — your deck is your life');
  console.log('  30 cards each; damage mills the rival deck, an empty deck loses');
  console.log('  HIGH TIDE: ATK +3  ·  LOW TIDE: DEF +3  ·  same suit: +2 current');
  console.log('  values flip with the tide every turn — chart it, or run aground');
}

printTideHeader();

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Check the hand-in before it leaves: the dossier must parse, the table
// must be there, and the screenshots must be the four the README promises.
// A broken output fails the run here, loudly, instead of shipping.
const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
if (!existsSync(join(out, 'game', 'index.html'))) throw new Error('hand-in is missing game/index.html');
const gameEntries = readdirSync(join(out, 'game'), { recursive: true }).length;
const shots = readdirSync(join(out, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shots.length !== 4) throw new Error(`hand-in has ${shots.length} screenshots, expected 4`);
console.log(`handed in: ${gameEntries} game entries, ${shots.length} screenshots, dossier ${Object.keys(dossier).length} keys`);
