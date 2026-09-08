import type { ReportData } from '../reportData';
import type { ReportConfig, SectionKey } from '../reportConfig';

/** What every section receives: the computed scenario, the report config, and
 *  the resolved section list (so the cover can list what's inside). */
export interface SectionProps {
  data: ReportData;
  config: ReportConfig;
  sections: SectionKey[];
}
