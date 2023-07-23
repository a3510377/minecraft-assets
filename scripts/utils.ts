import { writeFileSync } from 'fs';

export const writeJSONMinify = (filename: string, data: any) => {
  writeFileSync(`${filename}.json`, JSON.stringify(data, void 0, 2));
  writeFileSync(`${filename}.min.json`, JSON.stringify(data));
};
