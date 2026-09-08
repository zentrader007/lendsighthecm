// The advisor's own details, remembered in this browser so they're typed once
// and stamped on every presentation. Never part of the scenario; travels to
// the client only inside the report config of a link they build.
import { emptyAdvisor, type AdvisorProfile } from './reportConfig';
import { sanitizeAdvisor } from './reportShare';

const KEY = 'lendsight.advisorProfile.v1';

export function loadAdvisorProfile(): AdvisorProfile {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeAdvisor(JSON.parse(raw)) : { ...emptyAdvisor };
  } catch {
    return { ...emptyAdvisor };
  }
}

export function saveAdvisorProfile(profile: AdvisorProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeAdvisor(profile)));
  } catch {
    // Storage unavailable (private mode, quota) — the profile just isn't remembered.
  }
}
