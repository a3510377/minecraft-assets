import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import path from 'path';
import { Stream } from 'stream';

import AdmZip from 'adm-zip';
import axios from 'axios';
import simpleGit from 'simple-git';

import { writeJSONMinify } from './utils';
import { VersionData, getVersions } from './get_datapack';

const CACHE_PATH = 'assets';
const OUTPUT_PATH = 'output';
const TMP_PATH = 'tmp';

const getAssetsFromVersion = async (
  output: string,
  versionData: VersionData
) => {
  const version = await versionData.packageData();
  const {
    assetIndex: { url },
    downloads: {
      client: { url: clientDownloadURL },
    },
  } = version;

  try {
    console.time('Downloading client.jar');
    const { data } = await axios.get<Stream>(clientDownloadURL, {
      responseType: 'stream',
    });

    mkdirSync(TMP_PATH, { recursive: true });
    const stream = createWriteStream('tmp/client.jar');
    data.pipe(stream);

    await new Promise((resolve, reject) => {
      stream.on('close', resolve);
      stream.on('error', reject);
    });
    console.timeEnd('Downloading client.jar');
  } catch (err) {
    console.log('Failed to download client.jar');
  } finally {
    console.time('Extracting client.jar');
    new AdmZip('tmp/client.jar').getEntries().forEach((entry) => {
      if (!/^(assets|data)\//.test(entry.entryName)) return;

      const disPath = path.join(output, entry.entryName);
      mkdirSync(path.dirname(disPath), { recursive: true });
      writeFileSync(disPath, entry.getData());
    });
    console.timeEnd('Extracting client.jar');
  }

  const { data } = await axios.get<{
    objects: Record<string, { hash: string; size: number }>;
  }>(url);

  for (const [key, value] of Object.entries(data.objects)) {
    const hashPath = `${value.hash.substring(0, 2)}/${value.hash}`;
    const cachePath = path.join(CACHE_PATH, hashPath);

    let retry = 0;
    const getFile = async (): Promise<boolean> => {
      return await axios
        .get<Stream>(`https://resources.download.minecraft.net/${hashPath}`, {
          responseType: 'stream',
        })
        .then(({ data }) => {
          console.time(`Downloading asset: ${hashPath}`);

          mkdirSync(path.dirname(cachePath), { recursive: true });
          const stream = createWriteStream(cachePath);
          data.pipe(stream);

          return new Promise((resolve, reject) => {
            stream.on('close', resolve);
            stream.on('error', reject);
          });
        })
        .then(() => {
          console.timeEnd(`Downloading asset: ${hashPath}`);
          return true;
        })
        .catch(() => {
          if (retry++ > 3) {
            console.log(`Failed to download asset: ${key}`);
            return false;
          }

          console.log(`Retrying download asset (${retry}): ${key}`);
          return getFile();
        });
    };
    if (!existsSync(cachePath) && !(await getFile())) continue;

    const destPath = path.join(output, 'assets', key);
    mkdirSync(path.dirname(destPath), { recursive: true });

    if (!existsSync(destPath)) copyFileSync(cachePath, destPath);
  }

  mkdirSync(output, { recursive: true });

  // Write ${version}.json
  writeJSONMinify(path.join(output, version.id), version);
  // Write version.json
  writeJSONMinify(path.join(output, 'version'), versionData);
  // write assets.json
  writeJSONMinify(path.join(output, 'assets_index'), data);
};

if (require.main == module) {
  (async () => {
    const versions = await getVersions();
    const allTags = (await simpleGit().tags()).all;
    console.log(allTags);

    let start = new Date();
    for (const [version, info] of Object.entries(versions).reverse()) {
      if (!['release', 'snapshot'].includes(info.type)) continue;
      if (allTags.includes(version)) continue;
      if (new Date().getTime() - start.getTime() > 1e3 * 60 * 2) break;

      console.log('------------------------');
      console.log(`Generating version: ${version}`);
      console.log('------------------------');
      console.time(`Version generated: ${version}`);

      const output = path.join(OUTPUT_PATH, version);
      existsSync(output) && rmSync(output, { recursive: true });
      existsSync(TMP_PATH) && rmSync(TMP_PATH, { recursive: true });

      await getAssetsFromVersion(output, versions[version]);
      console.timeEnd(`Version generated: ${version}`);
    }

    readdirSync(OUTPUT_PATH).forEach((version) => {
      const deepScanning = (basePath: string) => {
        const fileMap: { directories: string[]; files: string[] } = {
          directories: [],
          files: [],
        };

        readdirSync(basePath).forEach((name) => {
          const filePath = path.join(basePath, name);
          const stat = statSync(filePath);

          if (stat.isFile()) fileMap.files.push(name);
          else if (stat.isDirectory()) {
            fileMap.directories.push(name);
            deepScanning(filePath);
          }
        });

        writeJSONMinify(path.join(basePath, '__paths_list__'), fileMap);
      };

      deepScanning(path.join(OUTPUT_PATH, version));
    });
  })();
}
