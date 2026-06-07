/**
 * Section prop contract for the `edgerunner-v2` template.
 * Mirrors edgerunner/sections/types.ts verbatim (self-contained per D-17).
 */
import type { PortfolioData, PublicSection } from '../../types';

export type SectionProps = { section: PublicSection | undefined };
export type FooterProps = { data: PortfolioData };
