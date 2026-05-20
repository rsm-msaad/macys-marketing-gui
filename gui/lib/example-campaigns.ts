import type { CampaignBriefInput } from "./api";

export type ExampleCampaign = CampaignBriefInput & {
  label: string;
  category: string;
  launch_date: string;
  channels: string[];
};

export const EXAMPLE_CAMPAIGNS: ExampleCampaign[] = [
  {
    label: "Mother's Day Beauty",
    name: "Mother's Day Beauty Event",
    category: "Beauty",
    sponsor: "VP of Marketing",
    filed_days_before_launch: 14,
    launch_date: "2026-06-10",
    objective:
      "Drive Beauty category revenue +20% vs last year's Mother's Day window. Win back lapsed Beauty buyers and acquire first-time Beauty customers from existing Macy's loyalists.",
    target_customer:
      "Women 28 to 55, Macy's Star Rewards members, with prior Beauty purchases or expressed Beauty preference. Emphasis on Gold and Platinum tier loyalty members.",
    promotional_offer: [
      "25% off all Beauty (excluding fragrance and prestige skincare)",
      "Free gift with purchase $75+",
      "Free shipping on Beauty orders over $50",
    ],
    campaign_window: {
      soft_launch: "14 days before Mother's Day",
      peak: "7 days before Mother's Day",
      closeout: "Mother's Day end of day",
    },
    budget: {
      paid_media: "$1.2M",
      store_experience: "$400K",
      email_crm: "$200K",
      total: "$1.8M",
    },
    success_metrics: {
      revenue_target: "$4.2M",
      roas_goal: "3.5x",
      new_beauty_customer_acquisition: "5,000+",
      email_open_rate: "22%+",
    },
    constraints: [
      "Legal review required for all final creative",
      "Cannot include prestige skincare brands (Tom Ford, La Mer, etc.)",
      "Regional pricing must reflect inventory levels",
      "Must include Star Rewards member-exclusive offer",
    ],
    channels: ["Email", "Display", "Social", "In-Store"],
  },
  {
    label: "Spring Beauty Refresh",
    name: "Spring Beauty Refresh",
    category: "Beauty",
    sponsor: "VP of Marketing",
    filed_days_before_launch: 30,
    launch_date: "2026-07-01",
    objective:
      "Drive Skincare and Lip category revenue +15% vs prior spring window. Re-engage lapsed Beauty buyers from holiday 2025 and convert Spring-browsing loyalists into purchasers.",
    target_customer:
      "Women 25 to 45, Macy's Star Rewards members, with prior Beauty or Skincare purchases. Emphasis on Silver and Gold tier loyalty members.",
    promotional_offer: [
      "20% off Skincare and Lip (excluding prestige brands)",
      "Free gift with purchase $65+",
      "Free shipping on Beauty orders over $50",
    ],
    campaign_window: {
      soft_launch: "March 1, 2026",
      peak: "March 8-15, 2026",
      closeout: "March 21, 2026",
    },
    budget: {
      paid_media: "$150K",
      store_experience: "$60K",
      email_crm: "$40K",
      total: "$250K",
    },
    success_metrics: {
      revenue_target: "$680K",
      roas_goal: "2.7x",
      new_beauty_customer_acquisition: "1,300+",
      email_open_rate: "23%+",
    },
    constraints: [
      "Legal review required for all final creative",
      "Cannot include prestige skincare brands",
      "Regional pricing must reflect inventory levels",
    ],
    channels: ["Email", "Social", "In-Store"],
  },
  {
    label: "Summer Style",
    name: "Summer Style",
    category: "Fashion",
    sponsor: "VP of Marketing",
    filed_days_before_launch: 44,
    launch_date: "2026-08-01",
    objective:
      "Drive summer apparel and swim category revenue +22% vs last July. Capture vacation-planning shoppers and convert spring browsers into summer wardrobe buyers.",
    target_customer:
      "Women and Men 22 to 40, Macy's Star Rewards members, with prior Apparel or Swim purchases or resort/vacation browsing history.",
    promotional_offer: [
      "25% off Swim and Resort Wear",
      "Buy 2 get 1 free on summer dresses",
      "Free shipping on orders over $75",
    ],
    campaign_window: {
      soft_launch: "July 1, 2026",
      peak: "July 4-12, 2026",
      closeout: "July 20, 2026",
    },
    budget: {
      paid_media: "$240K",
      store_experience: "$100K",
      email_crm: "$60K",
      total: "$400K",
    },
    success_metrics: {
      revenue_target: "$1.1M",
      roas_goal: "2.8x",
      new_summer_customer_acquisition: "2,500+",
      email_open_rate: "21%+",
    },
    constraints: [
      "Legal review required for all final creative",
      "Swim imagery must comply with brand modesty guidelines",
      "Regional pricing must reflect warehouse inventory",
    ],
    channels: ["Email", "SMS", "Social", "Display"],
  },
];
