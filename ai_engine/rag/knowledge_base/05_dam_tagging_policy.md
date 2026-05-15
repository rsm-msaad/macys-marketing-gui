# Digital Asset Management Tagging Policy

**Document ID:** DAM-TAG-2025-005
**Owner:** Creative Operations
**Last updated:** September 12, 2025
**Audience:** Creative, Production, Photography, Agency Partners

## Purpose

Every asset uploaded to the Macys Digital Asset Management system (DAM) must be tagged according to this policy. Proper tagging is what allows the Marketing, Merchandising, and Creative teams to find and reuse assets without recreating work. It also protects Macys from rights violations when models, photographers, or licensed properties are involved.

## Required Metadata Fields

Every asset must have the following fields populated at upload time. Assets missing any required field will be quarantined and will not surface in search.

* **Category**: top level (Apparel, Beauty, Home, Jewelry, Kids)
* **Subcategory**: more specific (Womens Apparel, Mens Apparel, Skincare, Fragrance, Bedding, etc)
* **Season**: SP25, SU25, FA25, HO25, etc
* **Model Rights Expiration**: the date the model release expires
* **Region Usage Rights**: which regions the asset may be used in (US, Canada, Puerto Rico, Restricted)
* **Photographer Credit**: full name and agency
* **Retouch Level**: minimal, standard, heavy (used by Brand to determine where the asset can appear)
* **Brand or Vendor**: if the asset features a specific brand SKU
* **Shoot Date**: original capture date

## Model Release Rule (90 Day Buffer)

Any asset featuring an identifiable model expires from active use 90 days before the model release expiration date, not on the expiration date itself. This 90 day buffer was added in 2024 after the Q3 incident where a model release lapsed mid campaign and creative had to be replaced inside 48 hours.

When an asset enters the 90 day window, the DAM flags it amber. When it enters the 30 day window, it flags red and is removed from active search results. Renewing a model release requires Creative Operations to initiate the renewal at least 60 days before the amber flag.

## Asset Flagging Process

If a user finds a degraded, low resolution, or unusable asset in the DAM, the user files a flag through the DAM portal. The flag captures:

* Asset ID
* Issue type (resolution, color, retouch, rights, other)
* Free text description
* Urgency (standard, high)

Creative Operations triages flags daily. Standard flags resolve within 5 business days. High urgency flags resolve within 1 business day.

## Restricted Use Cases

Assets tagged "Restricted" may not be used outside the explicit purpose listed in the asset notes. Common restricted cases include:

* Vendor sponsored shoots where the vendor retains shared rights
* Influencer collaborations with specific channel limits (Instagram only, no paid media, etc)
* Editorial features with one time use agreements

Using a restricted asset outside its agreement triggers a rights violation review by Legal.

## Resolution Threshold

After the Q4 2025 holiday incident where four key Beauty assets were ingested at degraded resolution and had to be rebuilt, the DAM enforces a minimum resolution check at upload. Assets below 300 DPI for print intent or below 2400 pixels on the long edge for digital intent are rejected at upload with a clear error message and a link to the reshoot request form.

## Tag Hygiene

Tag quality drifts over time. Creative Operations runs a quarterly tag audit and reaches out to original uploaders for clarification. Assets that remain mis tagged after the audit are quarantined until corrected.
