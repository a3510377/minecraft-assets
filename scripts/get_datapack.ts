import axios from 'axios';

// https://piston-meta.mojang.com/mc/game/version_manifest_v2.json
// https://launchermeta.mojang.com/mc/game/version_manifest_v2.json
const VersionManifestURL =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

type VersionType = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

export interface BaseData {
  id: string;
  url: string;
  sha1: string;
}

export interface BaseVersionData extends BaseData {
  type: VersionType;
  complianceLevel: 1 | 0; // 0 = not checked, 1 = checked
  [key: string]: any;
}

export interface VersionData extends BaseVersionData {
  packageData: () => Promise<{
    id: string;
    downloads: VersionDownloadsData;
    assetIndex: { size: number; totalSize: number } & BaseData;
    [key: string]: any;
  }>;
}

export interface VersionDownloadsData {
  server?: VersionDownloadData;
  client: VersionDownloadData;
}

export interface VersionDownloadData {
  sha1: string;
  size: number;
  url: string;
}

export async function getVersions() {
  const result: Record<string, VersionData> = {};
  const { data: manifest } = await axios.get<{
    latest: { snapshot: string; release: string };
    versions: BaseVersionData[];
  }>(VersionManifestURL);

  manifest.versions.forEach((data) => {
    result[data.id] = {
      ...data,
      packageData: async () => (await axios.get(data.url)).data,
    };
  });

  return result;
}

(async () => {
  await getVersions();
})();
