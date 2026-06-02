// Terms of Service + Privacy Policy. Required for Stripe Connect onboarding and
// general launch readiness. NOTE: this is reasonable starter content tailored to
// Birdie's stack (Stripe payments, coach/student accounts, Google OAuth, media
// uploads, email, video calls) — it is NOT legal advice and should be reviewed
// by counsel before launch. Update LAST_UPDATED and CONTACT_EMAIL as needed.

import { Link } from "react-router-dom";

const LAST_UPDATED = "June 2, 2026";
const CONTACT_EMAIL = "hello@ellisasun.com";

function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[760px]">
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
          Legal
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-3 leading-tight">
          {title}
        </h1>
        <p className="text-sm text-text-secondary mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="legal-prose space-y-8 text-[15px] leading-relaxed text-charcoal/90">
          {children}
        </div>

        <hr className="editorial-rule my-12" />
        <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
          <Link to="/terms" className="hover:text-charcoal transition-colors">Terms of Service</Link>
          <span aria-hidden>&middot;</span>
          <Link to="/privacy" className="hover:text-charcoal transition-colors">Privacy Policy</Link>
          <span aria-hidden>&middot;</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-charcoal transition-colors">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold mb-3 text-charcoal">{heading}</h2>
      <div className="space-y-3 text-text-secondary">{children}</div>
    </section>
  );
}

export function Terms() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="text-text-secondary">
        These Terms of Service ("Terms") govern your access to and use of Birdie
        (the "Service"), a platform that connects music students with coaches for
        lessons, practice tools, and related features. By creating an account or
        using the Service, you agree to these Terms. If you do not agree, do not
        use the Service.
      </p>

      <Section heading="1. Accounts">
        <p>
          You must provide accurate information when registering and keep your
          account credentials secure. You are responsible for all activity under
          your account. You may sign up with an email and password or via a
          supported third-party provider (e.g. Google). You must be at least 13
          years old, or have the consent of a parent or guardian, to use the
          Service.
        </p>
        <p>
          When you create an account you choose a role — <strong>student</strong>{" "}
          or <strong>coach</strong>. Coaches publish profiles, set availability and
          pricing, and deliver lessons; students book lessons and use practice
          features.
        </p>
      </Section>

      <Section heading="2. Lessons, bookings, and packages">
        <p>
          The Service lets students book one-time lessons, recurring lessons, and
          monthly lesson packages. Coaches set their own rates, availability, and
          package terms. Birdie is a platform that facilitates these arrangements;
          the lesson itself is a service provided by the coach, not by Birdie.
        </p>
        <p>
          Cancellation, rescheduling, and credit rules may depend on the booking
          type and the coach's policy as surfaced in the booking flow.
        </p>
      </Section>

      <Section heading="3. Payments">
        <p>
          Payments are processed by our third-party payment provider, Stripe.
          Coaches receive funds through Stripe Connect accounts. By making or
          receiving payments, you also agree to Stripe's applicable terms. Birdie
          does not store full payment card details.
        </p>
        <p>
          Prices are shown before checkout. Subscriptions and packages renew on a
          recurring basis until cancelled. You authorize recurring charges where
          applicable. Refunds, where offered, are subject to the coach's policy and
          applicable law.
        </p>
      </Section>

      <Section heading="4. Acceptable use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>violate any law or the rights of others;</li>
          <li>upload content you don't have the right to share, or that is unlawful, harmful, or infringing;</li>
          <li>harass, abuse, or harm another person;</li>
          <li>attempt to disrupt, reverse engineer, or gain unauthorized access to the Service.</li>
        </ul>
      </Section>

      <Section heading="5. Your content">
        <p>
          You retain ownership of content you submit — including audio recordings
          ("takes"), notes, profile information, and images. You grant Birdie a
          limited license to host, store, and display that content as needed to
          operate the Service (for example, delivering a take to your coach and
          their feedback back to you). You are responsible for the content you
          upload.
        </p>
      </Section>

      <Section heading="6. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate
          access if you violate these Terms or use the Service in a way that risks
          harm to others or to Birdie. Certain provisions survive termination,
          including payment obligations already incurred.
        </p>
      </Section>

      <Section heading="7. Disclaimers & limitation of liability">
        <p>
          The Service is provided "as is" without warranties of any kind. To the
          maximum extent permitted by law, Birdie is not liable for indirect,
          incidental, or consequential damages, and our total liability is limited
          to the amounts you paid to Birdie in the twelve months before the claim.
        </p>
      </Section>

      <Section heading="8. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material changes,
          we will update the "Last updated" date above and, where appropriate,
          notify you. Continued use of the Service after changes take effect
          constitutes acceptance.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          Questions about these Terms? Email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-iris hover:text-iris-hover">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}

export function Privacy() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="text-text-secondary">
        This Privacy Policy explains what information Birdie collects, how we use
        it, and the choices you have. By using the Service you agree to the
        practices described here.
      </p>

      <Section heading="1. Information we collect">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Account information</strong> — your name, email, role (student or coach), and password (stored hashed) or a linked Google account identifier.</li>
          <li><strong>Profile & lesson data</strong> — coach profiles, availability, pricing, bookings, lesson notes, practice routines, goals, and streaks.</li>
          <li><strong>Media you upload</strong> — audio takes, voice memos, and profile/cover images.</li>
          <li><strong>Payment information</strong> — handled by Stripe; we receive limited details such as payment status and identifiers, not full card numbers.</li>
          <li><strong>Usage & device data</strong> — basic technical information needed to operate and secure the Service.</li>
        </ul>
      </Section>

      <Section heading="2. How we use information">
        <p>We use your information to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>provide and improve the Service (scheduling, lessons, practice tools, take review);</li>
          <li>process payments and payouts;</li>
          <li>send transactional messages such as booking confirmations, reminders, and notifications;</li>
          <li>maintain security and prevent abuse.</li>
        </ul>
      </Section>

      <Section heading="3. Service providers">
        <p>We share information with third parties only as needed to run the Service:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Stripe</strong> — payment processing and Connect payouts.</li>
          <li><strong>Google</strong> — optional sign-in and (if you connect it) calendar features.</li>
          <li><strong>Email provider</strong> — to deliver transactional emails.</li>
          <li><strong>Cloudflare</strong> — hosting, media storage, and video-call infrastructure.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </Section>

      <Section heading="4. Sharing between coaches and students">
        <p>
          By design, certain information is shared between a coach and their
          students — for example, a student's takes and notes are visible to their
          coach, and a coach's profile and feedback are visible to their students.
          Only share what you're comfortable sharing in that context.
        </p>
      </Section>

      <Section heading="5. Data retention & security">
        <p>
          We retain your information for as long as your account is active or as
          needed to provide the Service and meet legal obligations. We use
          reasonable technical and organizational measures to protect your data,
          though no system is perfectly secure.
        </p>
      </Section>

      <Section heading="6. Your choices">
        <p>
          You can access and update much of your information from your account
          settings. To request deletion of your account or data, contact us at the
          email below. Some data may be retained as required by law (for example,
          payment records).
        </p>
      </Section>

      <Section heading="7. Children's privacy">
        <p>
          The Service is not directed to children under 13. If you believe a child
          has provided us personal information without appropriate consent, contact
          us and we will take steps to remove it.
        </p>
      </Section>

      <Section heading="8. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will
          be reflected in the "Last updated" date above.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          Questions about your privacy? Email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-iris hover:text-iris-hover">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
