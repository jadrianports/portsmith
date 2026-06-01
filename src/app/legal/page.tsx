/**
 * Legal — combined Terms & Privacy page (SAFE-05, D-08/D-09; 02-UI-SPEC "Legal").
 *
 * A STATIC Server Component at the top-level `/legal` path (NOT under the
 * `(auth)` route group). It lives at the root because `terms`/`privacy` are
 * reserved usernames (02-RESEARCH OQ3), so a top-level `/legal` route never
 * collides with the public `/[username]` space.
 *
 * It is the agreement the signup ToS checkbox links to ("I agree to the
 * [Terms & Privacy](/legal)"), so the affirmative-consent recorded at signup
 * (D-09) points at a real, reachable page (SAFE-05).
 *
 * Layout (UI-SPEC "Responsive Behavior", line 236): a single centered prose
 * column, max-width ~66ch (Body type), inside the same calm full-bleed canvas
 * the auth shell uses — the platform-chrome identity, token-driven, no inline
 * hex. The provisional-boilerplate `warning` Alert (D-09 copy, verbatim) sets
 * expectations that the text is placeholder until finalized before public
 * launch. No data, no input, no client JS — purely presentational RSC.
 */
import { Alert } from '@/components/ui/alert';
import { Link } from '@/components/ui/link';

export const metadata = {
  title: 'Terms & Privacy',
};

export default function LegalPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-background px-4 py-12">
      <header className="mb-10">
        <Link
          href="/"
          className="text-xl font-semibold !text-brand !no-underline hover:!text-brand-hover"
        >
          Portsmith
        </Link>
      </header>

      <main className="w-full max-w-[66ch]">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Terms &amp; Privacy
        </h1>

        <div className="mt-6">
          <Alert variant="warning">
            This is provisional boilerplate text and will be replaced with
            finalized terms before public launch.
          </Alert>
        </div>

        <div className="mt-8 flex flex-col gap-8 text-base leading-relaxed text-foreground">
          <section aria-labelledby="terms-heading">
            <h2
              id="terms-heading"
              className="text-[20px] font-semibold tracking-[-0.01em] text-foreground"
            >
              Terms of Service
            </h2>
            <div className="mt-4 flex flex-col gap-4 text-muted-foreground">
              <p>
                Welcome to Portsmith. By creating an account and using the
                service, you agree to these terms. Portsmith lets you publish a
                single-scroll portfolio by filling in structured content and
                choosing a curated template. You own the content you provide;
                Portsmith owns and maintains the templates and the platform.
              </p>
              <p>
                You are responsible for the accuracy and lawfulness of the
                content you publish, and for keeping your account credentials
                secure. You agree not to use the service to publish unlawful,
                infringing, deceptive, or abusive content, and not to attempt to
                disrupt, probe, or circumvent the platform&apos;s security or
                access controls.
              </p>
              <p>
                We may suspend or remove content or accounts that violate these
                terms, and we may update, change, or discontinue features of the
                service. The service is provided on an &ldquo;as is&rdquo; basis
                without warranties of any kind, and our liability is limited to
                the fullest extent permitted by law.
              </p>
              <p>
                These provisional terms will be replaced with finalized terms
                before public launch. Your continued use of the service after
                the finalized terms take effect constitutes acceptance of them.
              </p>
            </div>
          </section>

          <section aria-labelledby="privacy-heading">
            <h2
              id="privacy-heading"
              className="text-[20px] font-semibold tracking-[-0.01em] text-foreground"
            >
              Privacy Policy
            </h2>
            <div className="mt-4 flex flex-col gap-4 text-muted-foreground">
              <p>
                This Privacy Policy explains what information Portsmith collects
                and how it is used. We collect the account information you
                provide (such as your email address, username, and the content
                you choose to publish) and basic technical information needed to
                operate the service securely and reliably.
              </p>
              <p>
                We use your information to provide and maintain the service,
                authenticate your account, send transactional messages (such as
                account-confirmation and password-reset emails), and protect the
                platform against abuse. We do not sell your personal information.
              </p>
              <p>
                Content you choose to publish on your portfolio is public by
                design; private account details are not exposed on your public
                page. We use trusted service providers (for example, for
                hosting, database, email delivery, and spam protection) who
                process data on our behalf under appropriate safeguards.
              </p>
              <p>
                You can request access to, correction of, or deletion of your
                account data. This provisional policy will be replaced with a
                finalized privacy policy before public launch.
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <Link href="/signup" className="text-[13px]">
          Back to sign up
        </Link>
      </footer>
    </div>
  );
}
