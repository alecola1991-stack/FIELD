const fs = require('node:fs');
const path = require('node:path');
const { ASSET_NAME, hash, validateBundle } = require('./updates.cjs');
const root = path.join(__dirname, 'game');
const build = process.env.GITHUB_SHA || '0'.repeat(40);
const builtAt = Date.now();
fs.writeFileSync(path.join(__dirname, 'build-info.json'), JSON.stringify({ build, builtAt }));
function list(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? list(file) : [file];
  });
}
const bundle = { format: 1, minLauncher: 1, build, builtAt, files: list(root).map(file => {
  const data = fs.readFileSync(file);
  return { path: path.relative(root, file).split(path.sep).join('/'), sha256: hash(data), data: data.toString('base64') };
}) };
validateBundle(bundle);
fs.mkdirSync(path.join(__dirname, 'release'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'release', ASSET_NAME), JSON.stringify(bundle));
console.log('Verified game update:', build, bundle.files.length, 'files');
