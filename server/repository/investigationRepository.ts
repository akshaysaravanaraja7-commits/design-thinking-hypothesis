import fs from 'node:fs/promises';
import path from 'node:path';
import type { Investigation, InvestigationSummary } from '../../src/types/investigation';
import { toInvestigationSummary } from '../../src/utils/investigationLogic';
import { createDemoInvestigation } from '../data/demoInvestigation';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'investigations.json');

export interface InvestigationRepository {
  init(): Promise<void>;
  listSummaries(): Promise<InvestigationSummary[]>;
  getById(id: string): Promise<Investigation | null>;
  save(investigation: Investigation): Promise<Investigation>;
  delete(id: string): Promise<boolean>;
}

class FileInvestigationRepository implements InvestigationRepository {
  private cache = new Map<string, Investigation>();
  private initialized = false;
  private writeQueue: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const raw = await fs.readFile(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Investigation[];
      if (Array.isArray(parsed)) {
        for (const inv of parsed) {
          if (inv && typeof inv.id === 'string') {
            this.cache.set(inv.id, inv);
          }
        }
      }
    } catch {
      // Fresh store; will seed demo investigation below
    }

    const demo = createDemoInvestigation();
    if (!this.cache.has(demo.id)) {
      this.cache.set(demo.id, demo);
      await this.flush();
    }

    this.initialized = true;
  }

  private async flush(): Promise<void> {
    const items = Array.from(this.cache.values());
    const payload = JSON.stringify(items, null, 2);
    const tmpPath = `${STORE_PATH}.tmp`;

    this.writeQueue = this.writeQueue.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(tmpPath, payload, 'utf-8');
      await fs.rename(tmpPath, STORE_PATH);
    });

    await this.writeQueue;
  }

  async listSummaries(): Promise<InvestigationSummary[]> {
    await this.init();
    const list = Array.from(this.cache.values()).map(toInvestigationSummary);
    list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return list;
  }

  async getById(id: string): Promise<Investigation | null> {
    await this.init();
    const found = this.cache.get(id);
    return found ? structuredClone(found) : null;
  }

  async save(investigation: Investigation): Promise<Investigation> {
    await this.init();
    const updated: Investigation = {
      ...investigation,
      updatedAt: new Date().toISOString(),
    };
    this.cache.set(updated.id, structuredClone(updated));
    await this.flush();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.init();
    if (!this.cache.has(id)) return false;
    this.cache.delete(id);
    await this.flush();
    return true;
  }
}

export const investigationRepository: InvestigationRepository =
  new FileInvestigationRepository();
