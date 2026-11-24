export type MemberMarketFamily = "1x2" | "ou" | "btts" | "other";

export type MemberMarketFamilyPick = {
  key: string;
  family: MemberMarketFamily;
  market: string;
  selection: string;
  probability?: number | null;
  fairOdds?: number | null;
};

export function classifyMarketFamily(
  market: string,
  selection: string,
  key = "",
): MemberMarketFamily {
  const hay = `${market} ${selection} ${key}`.toLowerCase();
  if (/btts|both teams|karşılıklı/.test(hay)) return "btts";
  if (/over|under|üst|alt|o\/u|goals/.test(hay)) return "ou";
  if (/1x2|match result|home|away|draw|beraber|ms|maç sonucu/.test(hay)) {
    return "1x2";
  }
  return "other";
}
