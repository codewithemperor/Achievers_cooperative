// ============================================================
// ACHIEVERS COOPERATIVE ASSOCIATION - SITE CONTENT
// Edit this file to update any text on the website.
// ============================================================

export const siteConfig = {
  name: "Achievers Cooperative",
  tagline: "Shared progress. Trusted growth.",
  description:
    "Achievers Cooperative helps members save consistently, access fair credit, and build long-term prosperity through accountable, member-led finance.",
  url: "https://achieverscooperative.org",
  contactEmail: "achieverscooperative7124@gmail.com",
  contactPhone: "+234 703 387 1122",
  address: "NUT House, Beside hotel, Sasa Ibadan, Oyo State",
  foundedYear: 2024,
  workingHour: "Every Sunday, 10am to 11am",
  copyright: `© ${new Date().getFullYear()} Achievers Cooperative Association. All rights reserved.`,
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
  badge: "Member referrals guide new applications",
  headline: "Growing financial\nconfidence through\ncollective action",
  subheadline:
    "Achievers Cooperative brings together disciplined savers, responsible borrowers, and community-minded members who want practical support for real life goals.",
  ctaLabel: "Explore Our Services",
  ctaHref: "/services",
};

// ABOUT SNAPSHOT
export const aboutSnapshot = {
  label: "About",
  headline:
    "We are a member-owned cooperative built on trust, accountability, and the belief that people achieve more when they grow together.",
  ctaLabel: "Our story",
  ctaHref: "/about",
};

// SERVICES SECTION
export const servicesSection = {
  label: "Services",
  headline: "Practical support for savings, credit, and enterprise growth",
  subheadline:
    "Our services are designed to help members build stability, unlock opportunity, and move forward with confidence.",
};

export const services = [
  {
    slug: "cooperative-savings",
    title: "Cooperative Savings & Thrift",
    description:
      "Build disciplined savings with structured contribution plans that strengthen both personal resilience and the wider cooperative.",
    image: "/images/service-savings.jpg",
    imageAlt: "People at a community savings meeting",
  },
  {
    slug: "credit-loans",
    title: "Credit & Affordable Loans",
    description:
      "Access fair, member-centered loans with zero interest, clear terms, and repayment structures built for real households and businesses.",
    image: "/images/service-credit.jpg",
    imageAlt: "Handshake representing financial agreement",
  },
  {
    slug: "business-development",
    title: "Member Business Development",
    description:
      "Grow your enterprise through mentorship, market access, peer learning, and cooperative networks that open doors.",
    image: "/images/service-business.jpg",
    imageAlt: "Aerial view of cooperative farm or marketplace",
  },
];

// BENEFITS / WHY US SECTION
export const benefitsSection = {
  label: "Benefits",
  headline: "Why members stay with Achievers Cooperative",
  subheadline:
    "Our approach keeps finance understandable, accountable, and anchored in long-term member value.",
};

export const benefits = [
  {
    title: "Build with confidence",
    description:
      "Grow your savings in a structured environment that rewards consistency and long-term planning.",
    icon: "shield",
  },
  {
    title: "Borrow fairly",
    description:
      "Access affordable credit shaped by member needs, not aggressive fees or exploitative rates.",
    icon: "coins",
  },
  {
    title: "Be heard in governance",
    description:
      "Every member has a voice in decisions that shape the direction and priorities of the cooperative.",
    icon: "megaphone",
  },
  {
    title: "Grow through community",
    description:
      "Benefit from a trusted network of professionals, traders, and entrepreneurs who support one another.",
    icon: "network",
  },
];

export const statsNumbers = [
  { value: "40+", label: "Active members" },
  { value: "₦12m+", label: "Assets under management" },
  { value: "22", label: "Years of operation" },
  { value: "98%", label: "Member satisfaction" },
];

// TESTIMONIALS
export const testimonialsSection = {
  label: "Testimonials",
  headline: "What members say about the cooperative",
  subheadline:
    "The strongest proof of our work is the progress our members make over time.",
  ctaLabel: "Contact Member Services",
  ctaHref: "/contact",
};

export const testimonials = [
  {
    quote:
      "Achievers Cooperative helped me move from informal borrowing to a stable financing plan for my business.",
    name: "Amaka O.",
    company: "Sunrise Textile Co.",
    avatar: "/images/avatar-1.jpg",
  },
  {
    quote:
      "The savings structure gave my family the discipline we needed to build an emergency fund that actually lasts.",
    name: "Emeka N.",
    company: "Lagos Market Traders",
    avatar: "/images/avatar-2.jpg",
  },
  {
    quote:
      "I value how transparent the cooperative is. Members understand what is happening and have a say in it.",
    name: "Fatima B.",
    company: "Northern Agro Alliance",
    avatar: "/images/avatar-3.jpg",
  },
  {
    quote:
      "The business support sessions have been as valuable to me as the financial products themselves.",
    name: "Chidi M.",
    company: "TechBridge Ventures",
    avatar: "/images/avatar-4.jpg",
  },
  {
    quote:
      "You can feel the difference when a financial institution is truly built around its members.",
    name: "Grace A.",
    company: "Harvest Foods Ltd.",
    avatar: "/images/avatar-5.jpg",
  },
];

// NEWS / BLOG SECTION
export const newsSection = {
  label: "News & Insights",
  headline: "Stories, updates, and cooperative insight",
  ctaLabel: "View all",
  ctaHref: "/news",
};

export const newsArticles = [
  {
    slug: "annual-general-meeting-2025",
    category: "Governance",
    date: "January 11, 2025",
    title: "Achievers Cooperative holds its 2025 Annual General Meeting",
    excerpt:
      "Members reviewed performance, approved key resolutions, and aligned on the next stage of growth for the cooperative.",
    image: "/images/news-1.jpeg",
  },
  {
    slug: "new-loan-product-launch",
    category: "Finance",
    date: "February 20, 2025",
    title: "New flexible micro-loan product introduced for members",
    excerpt:
      "The new product is designed to support small traders and entrepreneurs with practical, easier-to-access credit.",
    // image: "/images/news-2.jpg",
  },
  // {
  //   slug: "community-farm-initiative",
  //   category: "Community",
  //   date: "January 10, 2025",
  //   title: "Cooperative-backed farming initiative opens new livelihoods",
  //   excerpt:
  //     "A new agricultural initiative expands member opportunity while strengthening local food production and shared income.",
  //   image: "/images/news-3.jpg",
  // },
  {
    slug: "digital-savings-platform",
    category: "Technology",
    date: "December 5, 2024",
    title: "Digital savings platform improves access for members",
    excerpt:
      "Members can now track balances, review contributions, and engage more easily with cooperative services online.",
    // image: "/images/news-4.jpg",
  },
  // {
  //   slug: "youth-empowerment-program",
  //   category: "Education",
  //   date: "November 18, 2024",
  //   title: "Youth empowerment program expands financial literacy reach",
  //   excerpt:
  //     "The cooperative continues investing in education that equips younger participants with practical financial skills.",
  //   image: "/images/news-5.jpg",
  // },
];

// FAQ SECTION
export const faqSection = {
  label: "FAQ",
  headline: "Questions people often ask us",
  subheadline: "A quick guide to how the cooperative works.",
};

export const faqs = [
  {
    question: "How does someone join the cooperative?",
    answer:
      "Membership is referral-based. New applicants are typically introduced by an existing member, after which the cooperative guides them through eligibility, documentation, and onboarding requirements.",
  },
  {
    question: "What is the minimum contribution requirement?",
    answer:
      "The minimum share capital contribution is ₦100,000, with a one-time registration fee of ₦20,000. Members may increase their shares over time to deepen participation and dividend potential.",
  },
  {
    question: "How are loans reviewed?",
    answer:
      "Loan applications are assessed using savings history, participation record, repayment capacity, and cooperative standing. The process is designed to be fair, transparent, and timely.",
  },
  {
    question: "When are dividends paid?",
    answer:
      "Dividends are declared annually after the cooperative's financial review and Annual General Meeting, based on performance and approved member resolutions.",
  },
  {
    question: "Can members access their savings when needed?",
    answer:
      "Yes. Withdrawal rules depend on the savings product involved, but members can request access subject to the notice periods and terms attached to that plan.",
  },
  {
    question: "How does the cooperative protect member funds?",
    answer:
      "Achievers Cooperative operates with structured governance, annual audits, documented controls, and regulated financial relationships that help safeguard member assets.",
  },
];

// CTA SECTION
export const ctaSection = {
  headline: "Need guidance on\nhow the cooperative works?",
  subheadline:
    "Our team can walk you through services, contribution structures, and the referral-based membership process.",
  ctaLabel: "Speak With Member Services",
  ctaHref: "/contact",
};

// ABOUT PAGE
export const aboutPage = {
  badge: "Our Story",
  headline: "Built from community,\nshaped by trust",
  intro:
    "Achievers Cooperative Association was founded in 2003 by a group of market traders and small business owners who wanted a fairer, more dependable way to save, borrow, and grow together.",
  history: `Over the past two decades, Achievers Cooperative has grown from a small founding circle into a trusted institution serving thousands of active members across multiple communities.

Through periods of uncertainty and economic pressure, the cooperative has remained focused on discipline, transparency, and practical value for members. Its steady growth has been driven not by shortcuts, but by consistent participation and accountable governance.

Today, Achievers Cooperative manages over ₦2.4 billion in member assets and has supported businesses, households, and long-term savings goals through a model built on shared responsibility.`,
  mission:
    "To empower members through accessible financial services, democratic governance, and a cooperative structure that turns discipline into long-term opportunity.",
  vision:
    "A future where more people can access fair financial systems, build stability, and grow through trusted collective action.",
  values: [
    {
      title: "Democratic Member Control",
      description:
        "Members shape the direction of the cooperative through participation, accountability, and shared decision-making.",
    },
    {
      title: "Transparency",
      description:
        "We believe trust grows when members can clearly understand the systems, numbers, and decisions that affect them.",
    },
    {
      title: "Equity",
      description:
        "Our goal is fair access, fair process, and fair treatment for every participating member.",
    },
    {
      title: "Education & Empowerment",
      description:
        "We invest in knowledge because informed members make stronger decisions for themselves and the cooperative.",
    },
    {
      title: "Community Concern",
      description:
        "We measure success not only by financial performance, but by the stability and progress our members create around them.",
    },
  ],
  team: [
    {
      name: "Rafiu Kabir Olanrewaju",
      role: "President",
      bio: "A founding member who has helped guide the cooperative with steady focus on governance, trust, and member welfare.",
      avatar: "/images/team-1.jpeg",
    },
    {
      name: "Aderoju Isiak Gbadegesin",
      role: "Vice President",
      bio: "Brings two decades of experience in cooperative finance and has helped scale operations while preserving member-first principles.",
      avatar: "/images/team-2.jpeg",
    },
    {
      name: "Soliu Saheed Olasunkanmi",
      role: "Secretary",
      bio: "Supports the day-to-day member experience and helps ensure that questions, concerns, and onboarding steps are handled well.",
      avatar: "/images/team-3.jpeg",
    },
    {
      name: "Soliu Yusuf Olamikan",
      role: "Treasurer",
      bio: "Leads responsible credit review and works to ensure members can access financing through clear, fair processes.",
      avatar: "/images/team-4.jpeg",
    },
    {
      name: "John Adewale Gbadesin",
      role: "Grand Patron",
      bio: "Leads responsible credit review and works to ensure members can access financing through clear, fair processes.",
      avatar: "/images/team-5.jpeg",
    },
  ],
};

// FOOTER
export const footer = {
  tagline: "Trusted cooperative finance since 2003.",
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
