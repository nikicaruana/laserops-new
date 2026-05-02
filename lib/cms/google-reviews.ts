import { fetchSheetAsObjects, parseNumericOr } from "@/lib/sheets";
import { CMS_REVALIDATE_SECONDS, CMS_URLS } from "./client";

type GoogleReviewRaw = Record<string, string> & {
  Reviewer_Name: string;
  Rating: string;
  Review_Text: string;
  Date: string;
  Display_Order: string;
  Status: string;
};

export type GoogleReview = {
  reviewerName: string;
  /** 1-5, clamped. Non-numeric or out-of-range values get clamped to 5. */
  rating: number;
  reviewText: string;
  /** Date in YYYY-MM-DD format as stored in the CMS. */
  date: string;
  displayOrder: number;
};

/**
 * Fetch published Google reviews from the CMS, sorted by display order.
 * Hidden reviews (Status !== "published") are filtered out.
 *
 * No rendering yet — wire this into a component when the reviews
 * section is built.
 */
export async function fetchGoogleReviews(): Promise<GoogleReview[]> {
  const result = await fetchSheetAsObjects<GoogleReviewRaw>(
    CMS_URLS.googleReviews,
    CMS_REVALIDATE_SECONDS,
  );
  if (!result.ok) return [];

  const reviews: GoogleReview[] = [];
  for (const row of result.rows) {
    const status = (row.Status ?? "").trim().toLowerCase();
    if (status !== "published") continue;

    const reviewerName = (row.Reviewer_Name ?? "").trim();
    if (reviewerName === "") continue;

    const rawRating = parseNumericOr(row.Rating, 5);
    const rating = Math.max(1, Math.min(5, Math.round(rawRating)));

    reviews.push({
      reviewerName,
      rating,
      reviewText: (row.Review_Text ?? "").trim(),
      date: (row.Date ?? "").trim(),
      displayOrder: parseNumericOr(row.Display_Order, 0),
    });
  }

  return reviews.sort((a, b) => a.displayOrder - b.displayOrder);
}
