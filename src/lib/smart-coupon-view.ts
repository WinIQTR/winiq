import type { SerializedCoupon } from "@/components/smart-coupon-workspace";
import type { SmartCouponCenter } from "@/lib/smart-coupon-engine";

export function serializeCouponCenter(center: SmartCouponCenter): {
  coupons: SerializedCoupon[];
  fallbackCoupons: SerializedCoupon[];
  generatedAt: string;
} {
  const serializeCoupon = (coupon: SmartCouponCenter["coupons"][number]): SerializedCoupon => ({
    ...coupon,
    oldestSourceUpdatedAt: coupon.oldestSourceUpdatedAt.toISOString(),
    legs: coupon.legs.map((leg) => ({
      ...leg,
      kickoffAt: leg.kickoffAt.toISOString(),
      sourceUpdatedAt: leg.sourceUpdatedAt.toISOString(),
    })),
  });
  return {
    generatedAt: center.generatedAt.toISOString(),
    coupons: center.coupons.map(serializeCoupon),
    fallbackCoupons: center.fallbackCoupons.map(serializeCoupon),
  };
}
