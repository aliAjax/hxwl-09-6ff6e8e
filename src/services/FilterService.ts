import type { FilterConditions } from "../domain/models";
import type { AppRepository } from "../repositories";
import { DEFAULT_FILTERS } from "../domain/constants";

export class FilterService {
  constructor(private repo: AppRepository) {}

  async get(): Promise<FilterConditions> {
    return this.repo.getFilters();
  }

  async save(filters: FilterConditions): Promise<void> {
    await this.repo.saveFilters(filters);
  }

  defaults(): FilterConditions {
    return { ...DEFAULT_FILTERS };
  }
}
