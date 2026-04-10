// ============================================================
// Acheivers COOPERATIVE ASSOCIATION - SITE CONTENT
// Edit this file to update any text on the website.
// ============================================================

export const siteConfig = {
  name: "Acheivers Cooperative",
  tagline: "People-powered. CommAcheivers-driven.",
  description:
    "Acheivers Cooperative Association empowers communities through collective ownership, shared resources, and democratic governance.",
  url: "https://Acheiverscoop.org",
  contactEmail: "hello@Acheiverscoop.org",
  contactPhone: "+1 (800) 468-2669",
  address: "14 Cooperative Way, Suite 200, Lagos, Nigeria",
  foundedYear: 2003,
  copyright: `© ${new Date().getFullYear()} Acheivers Cooperative Association. All rights reserved.`,
};

export const navLinks = [
  { label: "Home", href: "/#hero" },
  { label: "Services", href: "/#services" },
  { label: "About", href: "/about" },
  { label: "News", href: "/news" },
  { label: "Contact", href: "/contact" },
];

// HERO SECTION
export const hero = {
  badge: "Membership open this quarter",
  headline: "Building prosperity\nthrough collective\npower",
  subheadline:
    "Acheivers Cooperative Association helps individuals and communities grow wealth, share resources, and thrive together. Your journey to collective prosperity starts here.",
  ctaLabel: "Become a Member",
  ctaHref: "/contact",
};

// ABOUT SNAPSHOT
export const aboutSnapshot = {
  label: "About",
  headline:
    "We're a member-owned cooperative built on transparency, equity, and the belief that people are stronger together.",
  ctaLabel: "Learn more",
  ctaHref: "/about",
};

// SERVICES SECTION
export const servicesSection = {
  label: "Services",
  headline: "Your pathway to shared prosperity",
  subheadline:
    "We offer practical programs and resources that help members grow financially, access affordable credit, and build lasting commAcheivers wealth.",
};

export const services = [
  {
    slug: "cooperative-savings",
    title: "Cooperative Savings & Thrift",
    description:
      "Pool your savings with fellow members and earn competitive returns while supporting your commAcheivers.",
    image: "/images/service-savings.jpg",
    imageAlt: "People at a commAcheivers savings meeting",
  },
  {
    slug: "credit-loans",
    title: "Credit & Affordable Loans",
    description:
      "Access fair, low-interest credit without the barriers of traditional banking, designed for real people.",
    image: "/images/service-credit.jpg",
    imageAlt: "Handshake representing financial agreement",
  },
  {
    slug: "business-development",
    title: "Member Business Development",
    description:
      "Grow your enterprise with mentorship, group procurement, and market-linkage support from the cooperative.",
    image: "/images/service-business.jpg",
    imageAlt: "Aerial view of cooperative farm or marketplace",
  },
];

// BENEFITS / WHY US SECTION
export const benefitsSection = {
  label: "Benefits",
  headline: "Why join Acheivers Coop?",
  subheadline:
    "In a world of complex financial systems, we keep things fair, transparent, and member-first.",
};

export const benefits = [
  {
    title: "Secure your financial future",
    description:
      "Build long-term wealth through collective savings plans and dividend-sharing every fiscal year.",
    icon: "shield",
  },
  {
    title: "Access affordable credit",
    description:
      "No hidden fees. No predatory rates. Just fair, member-backed loans when you need them most.",
    icon: "coins",
  },
  {
    title: "Have a real voice",
    description:
      "Every member gets one vote. Decisions are made democratically, not by distant shareholders.",
    icon: "megaphone",
  },
  {
    title: "Network & grow together",
    description:
      "Connect with a thriving commAcheivers of entrepreneurs, farmers, and professionals who support each other.",
    icon: "network",
  },
];

export const statsNumbers = [
  { value: "5,200+", label: "Active members" },
  { value: "₦2.4B+", label: "Assets under management" },
  { value: "22", label: "Years of operation" },
  { value: "98%", label: "Member satisfaction" },
];

// TESTIMONIALS
export const testimonialsSection = {
  label: "Testimonials",
  headline: "Voices from our commAcheivers",
  subheadline:
    "Membership is a long-term relationship. Here's what our members have to say.",
  ctaLabel: "Become a Member",
  ctaHref: "/contact",
};

export const testimonials = [
  {
    quote:
      "Acheivers Coop turned what felt like an impossible dream into reality. I got my first business loan through them and never looked back.",
    name: "Amaka O.",
    company: "Sunrise Textile Co.",
    avatar: "/images/avatar-1.jpg",
  },
  {
    quote:
      "The cooperative savings plan helped my family build an emergency fund within a year. Truly life-changing.",
    name: "Emeka N.",
    company: "Lagos Market Traders",
    avatar: "/images/avatar-2.jpg",
  },
  {
    quote:
      "I love that every member has a voice. Acheivers Coop genuinely listens and acts on what we say.",
    name: "Fatima B.",
    company: "Northern Agro Alliance",
    avatar: "/images/avatar-3.jpg",
  },
  {
    quote:
      "Their business development workshops gave me skills I use every single day. Outstanding value.",
    name: "Chidi M.",
    company: "TechBridge Ventures",
    avatar: "/images/avatar-4.jpg",
  },
  {
    quote:
      "Three years in, and I've already earned dividends twice. The transparency here is unmatched.",
    name: "Grace A.",
    company: "Harvest Foods Ltd.",
    avatar: "/images/avatar-5.jpg",
  },
];

// NEWS / BLOG SECTION
export const newsSection = {
  label: "News & Insights",
  headline: "Stories from the cooperative world",
  ctaLabel: "View all",
  ctaHref: "/news",
};

export const newsArticles = [
  {
    slug: "annual-general-meeting-2025",
    category: "Governance",
    date: "March 15, 2025",
    title: "Acheivers Coop holds successful Annual General Meeting 2025",
    excerpt:
      "Members gathered to review the year's performance, elect new board members, and vote on key resolutions.",
    image: "/images/news-1.jpg",
  },
  {
    slug: "new-loan-product-launch",
    category: "Finance",
    date: "February 20, 2025",
    title: "New micro-loan product now available to all members",
    excerpt:
      "Designed for small traders and artisans, our new flexible micro-loan product requires zero collateral.",
    image: "/images/news-2.jpg",
  },
  {
    slug: "commAcheivers-farm-initiative",
    category: "CommAcheivers",
    date: "January 10, 2025",
    title: "Launching our commAcheivers cooperative farm initiative",
    excerpt:
      "Acheivers Coop kicks off its first large-scale cooperative farming project, creating 200 new livelihoods.",
    image: "/images/news-3.jpg",
  },
  {
    slug: "digital-savings-platform",
    category: "Technology",
    date: "December 5, 2024",
    title: "Our new digital savings platform is now live",
    excerpt:
      "Members can now manage contributions, check balances, and apply for loans directly from their phones.",
    image: "/images/news-4.jpg",
  },
  {
    slug: "youth-empowerment-program",
    category: "Education",
    date: "November 18, 2024",
    title: "Youth empowerment program enrolls 350 new participants",
    excerpt:
      "Our 6-month financial literacy and entrepreneurship program continues to transform young lives.",
    image: "/images/news-5.jpg",
  },
];

// FAQ SECTION
export const faqSection = {
  label: "FAQ",
  headline: "Frequently asked questions",
  subheadline: "Everything you need to know before joining.",
};

export const faqs = [
  {
    question: "How do I become a member?",
    answer:
      "Joining is simple. Fill out the membership application form online or visit any of our branch offices. Pay the one-time membership fee and initial share capital, and you're in. The whole process takes less than 24 hours.",
  },
  {
    question: "What is the minimum contribution to join?",
    answer:
      "The minimum share capital contribution is ₦10,000, with a one-time registration fee of ₦2,000. Members may increase their shares at any time to earn greater dividends.",
  },
  {
    question: "How are loans processed?",
    answer:
      "Loan applications are reviewed within 5 business days. Approval is based on your savings history and cooperative standing, not external credit scores. No collateral is required for loans up to three times your total savings.",
  },
  {
    question: "When are dividends paid?",
    answer:
      "Dividends are declared and distributed annually, at the end of each fiscal year, following the AGM. The amount depends on the cooperative's overall performance and your share balance.",
  },
  {
    question: "Can I withdraw my savings at any time?",
    answer:
      "Yes. Members can make partial withdrawals with a 7-day notice period. Full share withdrawal requires 30 days' notice and is processed at the end of the quarter.",
  },
  {
    question: "Is my money safe in the cooperative?",
    answer:
      "Absolutely. Acheivers Coop is registered with the national cooperative registry, audited annually, and holds all member funds in licensed financial institutions. We also carry cooperative insurance for added protection.",
  },
];

// CTA SECTION
export const ctaSection = {
  headline: "Ready to grow\ntogether?",
  subheadline:
    "Join thousands of members already building financial security and commAcheivers wealth with Acheivers Coop. Membership is open, and it starts with a single step.",
  ctaLabel: "Join Acheivers Coop Today",
  ctaHref: "/contact",
};

// ABOUT PAGE
export const aboutPage = {
  badge: "Our Story",
  headline: "Born from commAcheivers,\nbuilt for people",
  intro:
    "Acheivers Cooperative Association was founded in 2003 by a group of 47 market traders in Lagos who were tired of predatory money lenders and exclusionary banks. Armed with little more than trust and a shared vision, they pooled their savings and established what would become one of Nigeria's most respected cooperative societies.",
  history: `Over the past two decades, Acheivers Coop has grown from those original 47 members to over 5,200 active members across six states. Through economic downturns, currency crises, and global pandemics, the cooperative has remained profitable and member-focused, paying dividends every single year since 2005.

In 2010, we expanded our mandate beyond savings and credit to include agricultural support, housing schemes, and small business development. In 2018, we launched our digital platform, making cooperative services accessible to members in remote areas for the first time.

Today, Acheivers Coop manages over ₦2.4 billion in member assets and has disbursed more than ₦800 million in loans to date. Our success is not measured in profit margins; it is measured in the homes built, businesses started, and families stabilized because of collective action.`,
  mission:
    "To empower individuals and communities through cooperative principles, providing accessible financial services, democratic governance, and shared economic opportAcheivers for every member.",
  vision:
    "A Nigeria where every person, regardless of background, has access to fair financial systems and the power to build lasting wealth through collective effort.",
  values: [
    {
      title: "Democratic Member Control",
      description:
        "Every member has one equal vote. Decisions are made together, not from the top down.",
    },
    {
      title: "Transparency",
      description:
        "Full financial disclosure to all members, annually audited, and always accessible.",
    },
    {
      title: "Equity",
      description:
        "Fair treatment for all, regardless of savings size, occupation, or social standing.",
    },
    {
      title: "Education & Empowerment",
      description:
        "We invest in member knowledge because informed members build stronger cooperatives.",
    },
    {
      title: "CommAcheivers Concern",
      description:
        "Our mission extends beyond membership to the health and development of the wider commAcheivers.",
    },
  ],
  team: [
    {
      name: "Ngozi Adeyemi",
      role: "President & Co-founder",
      bio: "One of the original 47 founding members. Has led Acheivers Coop through 22 years of growth with unwavering commitment to member welfare.",
      avatar: "/images/team-1.jpg",
    },
    {
      name: "Babatunde Okafor",
      role: "General Manager",
      bio: "20 years in cooperative finance and development banking. Joined Acheivers Coop in 2012 and led the expansion to six states.",
      avatar: "/images/team-2.jpg",
    },
    {
      name: "Aisha Mohammed",
      role: "Head of Credit & Loans",
      bio: "A chartered accountant with deep expertise in microfinance, Aisha has approved over 12,000 member loans with an industry-low default rate.",
      avatar: "/images/team-3.jpg",
    },
    {
      name: "Femi Adebayo",
      role: "Head of Member Services",
      bio: "Member of Acheivers Coop since 2006 and staff since 2014. Femi is the face of our member experience, ensuring every voice is heard.",
      avatar: "/images/team-4.jpg",
    },
  ],
};

// FOOTER
export const footer = {
  tagline: "People-powered cooperative finance since 2003.",
  pages: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Services", href: "/#services" },
    { label: "News", href: "/news" },
  ],
  information: [
    { label: "Contact", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Member Portal", href: "/portal" },
  ],
  socials: [
    { label: "Facebook", href: "#" },
    { label: "Instagram", href: "#" },
    { label: "X (Twitter)", href: "#" },
    { label: "LinkedIn", href: "#" },
  ],
};
