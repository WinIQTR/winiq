import type { SerializedCoupon } from "@/components/smart-coupon-workspace";
import type { SmartCouponCenter } from "@/lib/smart-coupon-engine";

export function serializeCouponCenter(center: SmartCouponCenter): {
  coupons: SerializedCoupon[];
  generatedAt: string;
} {
  return {
    generatedAt: center.generatedAt.toISOString(),
    coupons: center.coupons.map((coupon) => ({
      ...coupon,
      oldestSourceUpdatedAt: coupon.oldestSourceUpdatedAt.toISOString(),
      legs: coupon.legs.map((leg) => ({
        ...leg,
        kickoffAt: leg.kickoffAt.toISOString(),
        sourceUpdatedAt: leg.sourceUpdatedAt.toISOString(),
      })),
    })),
  };
}
