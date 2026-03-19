export const isCoachView = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('coach');

export const coachViewUrl = (): string => {
  const base = window.location.href.split('?')[0];
  return base + '?coach';
};
