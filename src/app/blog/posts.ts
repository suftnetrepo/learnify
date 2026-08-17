export interface BlogPost {
  slug:       string;
  tag:        string;
  title:      string;
  excerpt:    string;
  author:     string;
  authorInit: string;
  authorRole: string;
  date:       string;
  readTime:   string;
  color:      string;
  content:    Section[];
}

export interface Section {
  type:     "heading" | "paragraph" | "list" | "quote" | "callout";
  text?:    string;
  items?:   string[];
  label?:   string;
}

export const POSTS: BlogPost[] = [
  {
    slug:       "how-to-learn-faster-science-of-skill-acquisition",
    tag:        "Learning Science",
    title:      "How to Learn Faster: The Science Behind Skill Acquisition",
    excerpt:    "Most people learn inefficiently — they re-read notes, highlight passages, and hope it sticks. Research shows there are dramatically better approaches. Here's what actually works.",
    author:     "James Okafor",
    authorInit: "JO",
    authorRole: "Head of Curriculum",
    date:       "12 August 2026",
    readTime:   "8 min read",
    color:      "bg-brand-500",
    content: [
      { type: "paragraph", text: "Most people learn the same way they were taught in school: read the material, highlight the important bits, re-read your highlights before the test. It feels productive. Your book is full of colour. You've sat with the content for hours. And yet, a week later, most of it is gone." },
      { type: "paragraph", text: "The reason is simple: these techniques feel like learning because they're familiar, but they don't produce lasting memory. Cognitive science has known this for decades. The question is why mainstream education still ignores it — and what you can do about it." },
      { type: "heading", text: "The forgetting curve is real" },
      { type: "paragraph", text: "Hermann Ebbinghaus mapped the forgetting curve in the 1880s. Without reinforcement, you forget roughly 50% of new information within an hour, 70% within a day, and 90% within a week. This isn't a deficiency — it's your brain doing exactly what it's supposed to. Memory consolidation is metabolically expensive. Your brain deprioritises information it doesn't think you need." },
      { type: "paragraph", text: "The implication: the timing of practice matters as much as the amount. Spacing your study sessions — revisiting material just as you're about to forget it — forces your brain to reconstruct the memory, which strengthens the neural pathway each time." },
      { type: "heading", text: "What the research actually recommends" },
      { type: "list", items: [
        "Spaced repetition: Revisit material at increasing intervals (1 day, 3 days, 1 week, 2 weeks). Tools like Anki automate this.",
        "Active recall: Close the book and try to retrieve what you just learned. The struggle is the point — generation effect means that effortful retrieval strengthens memory far more than passive re-reading.",
        "Interleaving: Mix different topics or problem types in a single session rather than blocking one topic per session. It feels harder and slower, but produces better long-term retention.",
        "The Feynman technique: Try to explain the concept in simple language as if teaching it to someone who knows nothing. Gaps in your explanation reveal gaps in your understanding.",
        "Elaborative interrogation: Ask 'why does this work?' and 'how does this connect to what I already know?' Connecting new information to existing knowledge creates more retrieval pathways.",
      ]},
      { type: "heading", text: "The myth of learning styles" },
      { type: "paragraph", text: "You've probably heard that you're a visual, auditory, or kinaesthetic learner. This is one of the most persistent myths in education. Dozens of studies have found no evidence that matching instruction to a person's preferred 'learning style' improves outcomes. What does work — for almost everyone — is varied presentation: diagrams and text and spoken explanation and hands-on practice. The more modalities, the more retrieval routes." },
      { type: "callout", label: "Key insight", text: "The techniques that feel most effective — re-reading, highlighting, summarising — consistently underperform in controlled studies. The techniques that feel hardest — recall, spacing, interleaving — consistently produce the best long-term retention. Lean into the difficulty." },
      { type: "heading", text: "What this means for your Learnify courses" },
      { type: "paragraph", text: "Every Learnify course is structured with these principles in mind. Lectures are deliberately concise so you can space them out. Review prompts appear at the end of each section. Project work forces you to apply concepts rather than just receive them." },
      { type: "paragraph", text: "But the biggest lever is in your hands. Don't watch a lecture and immediately move on. Close your laptop. Write down everything you remember without looking. Check what you missed. Come back to the hardest concepts tomorrow. That cycle — retrieval, check, space, repeat — is how skills become permanent." },
    ],
  },
  {
    slug:       "transferable-skills-that-employers-actually-want",
    tag:        "Career",
    title:      "The 8 Transferable Skills Employers Actually Want in 2026",
    excerpt:    "Beyond the job spec, there are skills that make the difference between a shortlist and an offer. Here are the eight we see come up time and again.",
    author:     "Sophie Chen",
    authorInit: "SC",
    authorRole: "Head of Product",
    date:       "8 August 2026",
    readTime:   "6 min read",
    color:      "bg-emerald-500",
    content: [
      { type: "paragraph", text: "Job specs are written by committees and optimised for applicant tracking systems. They list the technologies and qualifications you need to get past the filter. But the skills that actually get you hired — and kept — are rarely on the spec." },
      { type: "paragraph", text: "We interviewed 40 hiring managers across technology, finance, design, and operations to find out what they're actually looking for. These eight came up in almost every conversation." },
      { type: "heading", text: "1. Clear written communication" },
      { type: "paragraph", text: "The ability to write a clear, concise message that gets to the point and anticipates the reader's questions is rare and valuable. Remote and hybrid work has made this more important than ever — a team that communicates well in writing moves faster than one that doesn't." },
      { type: "heading", text: "2. Structured problem decomposition" },
      { type: "paragraph", text: "Not just 'problem solving' — specifically the ability to take an ambiguous, complex problem and break it into defined, tractable components. This is what separates people who get overwhelmed by big projects from people who can start executing immediately." },
      { type: "heading", text: "3. Intellectual curiosity" },
      { type: "paragraph", text: "Hiring managers want people who learn fast because the role they're hiring for will look different in 18 months. Curiosity — the habit of asking how things work and why — is the best predictor of fast learning." },
      { type: "heading", text: "4. Constructive disagreement" },
      { type: "paragraph", text: "The ability to push back on a decision clearly and without damaging the relationship is extraordinarily valuable. Most people either stay silent when they disagree or express disagreement in a way that creates conflict. Being able to say 'I have a concern about this — can I walk you through it?' is a superpower." },
      { type: "heading", text: "5. Prioritisation under pressure" },
      { type: "paragraph", text: "Everything always feels urgent. People who can identify what actually matters — and confidently deprioritise the rest — are worth their weight in gold. This requires both analytical thinking and the confidence to defend your prioritisation to stakeholders." },
      { type: "heading", text: "6. Data literacy" },
      { type: "paragraph", text: "You don't need to be a data scientist. But the ability to read a chart critically, ask the right questions about how data was collected, and form conclusions that are proportionate to the evidence — this is table stakes in 2026 across almost every field." },
      { type: "heading", text: "7. Ownership mentality" },
      { type: "paragraph", text: "The difference between someone who does their job and someone who takes responsibility for outcomes is enormous. Ownership means proactively flagging problems, following up without being chased, and treating your employer's goals as your own." },
      { type: "heading", text: "8. Stakeholder management" },
      { type: "paragraph", text: "In almost every role beyond entry level, you're managing up, down, and sideways simultaneously. The ability to understand what different stakeholders need, communicate progress in terms that matter to them, and manage expectations proactively is consistently mentioned as a differentiator." },
      { type: "callout", label: "The pattern", text: "Notice that only one of these eight (data literacy) is remotely technical. The rest are interpersonal, cognitive, and attitudinal. These are skills you can build deliberately — and they transfer across every job, company, and industry you'll ever work in." },
    ],
  },
  {
    slug:       "online-vs-in-person-learning-which-is-right",
    tag:        "Learning",
    title:      "Online vs In-Person Learning: Which Is Actually Better for You?",
    excerpt:    "The answer depends on what you're learning and how you learn. Here's a framework for making the right choice for your goals.",
    author:     "Priya Sharma",
    authorInit: "PS",
    authorRole: "Co-founder & CTO",
    date:       "4 August 2026",
    readTime:   "5 min read",
    color:      "bg-amber-500",
    content: [
      { type: "paragraph", text: "The online vs in-person debate misses the point. Neither is universally better. The right choice depends on three things: what you're learning, your current level, and how you personally work best under which conditions." },
      { type: "paragraph", text: "Here's a framework for thinking it through." },
      { type: "heading", text: "When online learning wins" },
      { type: "list", items: [
        "Conceptual and theoretical knowledge: watching a lecture on statistical concepts or reading about design principles is equally effective online. The medium doesn't matter much when the goal is information transfer.",
        "Self-directed learners: if you have a clear goal, good self-discipline, and the ability to unblock yourself when stuck, online learning removes all the scheduling overhead of in-person.",
        "Iterative technical skills: coding, design, data analysis — anything you learn by doing rather than watching benefits from the ability to pause, rewind, and re-watch at the exact moment you need it.",
        "Supplementary learning: adding skills alongside a full-time job. Online learning fits around your schedule; in-person doesn't.",
      ]},
      { type: "heading", text: "When in-person wins" },
      { type: "list", items: [
        "Interpersonal and practical skills: leadership, facilitation, negotiation, presentation — skills where the feedback loop requires another human being to be in the room.",
        "Hands-on technical work: welding, surgery, lab techniques, physical therapy. Some things cannot be learned on a screen.",
        "Early stages of a new field: when you don't know what you don't know, being around experts lets you absorb context you didn't know to look for. The informal learning between sessions is often as valuable as the formal content.",
        "Accountability-dependent learners: if you know you won't do the reading, a fixed schedule with other people forces you to show up.",
      ]},
      { type: "heading", text: "The hybrid sweet spot" },
      { type: "paragraph", text: "The most effective approach for most adult learners is a hybrid: structured online content for knowledge acquisition, combined with live sessions (in-person or virtual) for application, feedback, and discussion." },
      { type: "paragraph", text: "This is why Learnify offers all three formats. The online catalogue gives you flexibility. Live cohorts give you accountability and community. In-person workshops give you the tacit, contextual learning that screens can't replicate." },
      { type: "callout", label: "The question to ask", text: "Before choosing a format, ask: 'What's the hardest part of learning this skill?' If it's understanding the concepts, online is fine. If it's practising under pressure with real feedback, you need live interaction." },
    ],
  },
  {
    slug:       "how-to-get-most-from-online-course",
    tag:        "Tips",
    title:      "10 Ways to Get the Most Out of an Online Course",
    excerpt:    "The completion rate for online courses is famously low. These 10 habits separate the people who finish and apply from the people who don't.",
    author:     "James Okafor",
    authorInit: "JO",
    authorRole: "Head of Curriculum",
    date:       "29 July 2026",
    readTime:   "7 min read",
    color:      "bg-violet-500",
    content: [
      { type: "paragraph", text: "The average completion rate for online courses is around 15%. That's not a content problem — it's a behaviour problem. The people who complete courses and apply what they learn aren't smarter or more motivated. They've developed habits that make completion the default, not the exception." },
      { type: "heading", text: "Before you start" },
      { type: "list", items: [
        "Define your outcome before you begin. 'I want to be better at data analysis' is too vague. 'I want to be able to build a dashboard in Tableau by 1 September' is a goal you can work backwards from.",
        "Block calendar time. Treat course sessions like meetings with your future self. Without dedicated time, courses get pushed by whatever feels urgent.",
        "Set up your environment. Close your email. Put your phone in another room. A dedicated, distraction-free hour beats four distracted ones.",
      ]},
      { type: "heading", text: "While you're learning" },
      { type: "list", items: [
        "Take notes by hand where possible. Typing encourages transcription; handwriting forces synthesis. Your notes should be in your words, not the instructor's.",
        "Pause and recall after every section. Before moving on, close your notes and write down everything you remember. This single habit doubles retention.",
        "Apply immediately. Every concept you learn should be applied within 24 hours — even in a toy project. Application reveals gaps that passive watching misses.",
        "Ask the question you're embarrassed to ask. The question you think is stupid is usually the one everyone else has. Get it answered.",
      ]},
      { type: "heading", text: "When you get stuck" },
      { type: "list", items: [
        "Give yourself 20 minutes to be stuck before asking for help. Productive struggle is part of learning. But know when to ask — stuck for days with no progress helps no one.",
        "Use rubber duck debugging. Explain your problem out loud to an imaginary person. You'll often solve it mid-explanation.",
      ]},
      { type: "heading", text: "After you finish" },
      { type: "list", items: [
        "Build something real. A portfolio project, a work tool, a side project. The course is the tutorial; the project is the education.",
      ]},
      { type: "callout", label: "The single biggest predictor", text: "In our analysis of Learnify completion data, the single biggest predictor of finishing a course is whether a student applies content in the first 48 hours. Students who do are 4x more likely to complete. Don't wait until you've 'finished learning' to start doing." },
    ],
  },
  {
    slug:       "career-change-at-30-what-to-know",
    tag:        "Career",
    title:      "Career Change at 30+: What You Need to Know Before You Start",
    excerpt:    "Making a career change later in life is harder — and more possible — than most people think. Here's an honest guide to what the process actually looks like.",
    author:     "Alex Morgan",
    authorInit: "AM",
    authorRole: "Co-founder & CEO",
    date:       "22 July 2026",
    readTime:   "9 min read",
    color:      "bg-rose-500",
    content: [
      { type: "paragraph", text: "Every week I talk to people in their 30s, 40s, and 50s who want to change careers. Most of them are paralysed by the same fears: that they've left it too late, that they can't afford to start over, that employers won't take them seriously without the right background." },
      { type: "paragraph", text: "Some of those fears are real. Most of them are manageable. Here's what the process actually looks like." },
      { type: "heading", text: "The honest case for why it's harder" },
      { type: "paragraph", text: "A career change at 35 is harder than one at 22 for structural reasons, not personal ones. You have more financial obligations. You have less time for full-time study. You're competing against candidates with 5+ years of specific experience. And the sunk cost of the career you've built creates psychological resistance to change." },
      { type: "paragraph", text: "Being honest about this is the first step. The people who struggle most are the ones who underestimate what the transition requires and then feel like they're failing when it takes longer than expected." },
      { type: "heading", text: "The honest case for why it's more possible than you think" },
      { type: "list", items: [
        "You have more to offer than you realise. A decade of work experience — domain knowledge, stakeholder management, problem-solving under pressure — is genuinely valuable in almost every field. You're not starting from zero.",
        "The skills gap is usually smaller than it looks. Most career changes are adjacencies, not complete pivots. A marketer moving into product brings audience insight and commercial instinct that a pure technologist doesn't have.",
        "Hiring managers are humans. A compelling story of why you're making this change, backed by evidence that you've already started building the new skills, is more persuasive than a CV that looks perfect on paper.",
        "The return on investment compounds. A career change at 35 gives you 30 more working years to benefit from it. The payoff period is long.",
      ]},
      { type: "heading", text: "What the process actually looks like" },
      { type: "paragraph", text: "The most successful career changers I've worked with follow a similar pattern: they don't quit their job first. They validate the new direction while still employed — taking courses, building a portfolio, doing freelance or volunteer work in the new field. They make the transition in steps, not leaps." },
      { type: "paragraph", text: "The full-time study approach works for some people, but it's high-risk. You're betting everything on a direction you haven't validated. Starting part-time lets you test assumptions before you commit." },
      { type: "callout", label: "The question that matters", text: "Before you plan the career change, answer this: 'What evidence do I have that I'll actually enjoy working in this new field?' Enthusiasm for an idea and enjoyment of the daily work are different things. Find ways to test the experience before you commit." },
      { type: "heading", text: "The timeline to expect" },
      { type: "paragraph", text: "A realistic timeline for a significant career change — new industry, new function — is 12 to 24 months from starting to learn to landing a job in the new field. This assumes 8-10 hours per week of deliberate effort alongside existing work." },
      { type: "paragraph", text: "That sounds long. But it's shorter than most people spend in an unsatisfying career while waiting for the right moment to change." },
    ],
  },
  {
    slug:       "why-certificates-matter-more-than-degrees",
    tag:        "Opinion",
    title:      "Why Skill Certificates Are Replacing Degrees for Hiring Managers",
    excerpt:    "A growing number of companies have dropped degree requirements. Here's what they're looking for instead — and how to position yourself accordingly.",
    author:     "Sophie Chen",
    authorInit: "SC",
    authorRole: "Head of Product",
    date:       "15 July 2026",
    readTime:   "6 min read",
    color:      "bg-sky-500",
    content: [
      { type: "paragraph", text: "In 2023, IBM, Google, Apple, and hundreds of other companies removed degree requirements from the majority of their job postings. In 2024, the UK government published data showing that graduate hiring managers ranked 'demonstrable skills' above 'degree classification' for the first time." },
      { type: "paragraph", text: "This is a structural shift, not a trend. And it has significant implications for how you build and present your credentials." },
      { type: "heading", text: "Why the shift is happening" },
      { type: "paragraph", text: "The 3-year degree was never a perfect signal of job readiness — it was the best available signal in a world without alternatives. Employers used it as a proxy for baseline intelligence, work ethic, and the ability to complete a long-term project." },
      { type: "paragraph", text: "The problem is that this signal has become increasingly noisy. Degree inflation means a higher percentage of the population has a degree, so it differentiates less. Grade inflation means results are harder to interpret. And the skills taught in many degree programmes have drifted from what employers actually need." },
      { type: "heading", text: "What actually signals competence now" },
      { type: "list", items: [
        "Demonstrated output: a portfolio, a GitHub repository, a project delivered. Proof that you can produce the work, not just pass an exam about it.",
        "Specific skill credentials: not just 'I know Python' but 'I completed this course, built this project, and can speak to this problem I solved using it'.",
        "Real-world context: work experience, freelance clients, open-source contributions. Evidence that you've applied skills in messy real conditions, not just controlled assessments.",
        "Referrals and social proof: a colleague's endorsement carries more weight than a certificate from an institution a hiring manager doesn't know.",
      ]},
      { type: "heading", text: "How to position skill credentials effectively" },
      { type: "paragraph", text: "A certificate by itself doesn't do much. What matters is the narrative around it: why you chose this skill, what you built with it, what problem it solved. A certificate from a rigorous course — especially one where you completed a substantial project — is a meaningful signal when paired with that context." },
      { type: "callout", label: "The honest caveat", text: "Credentials still matter more in some fields and seniority levels than others. Regulated professions (medicine, law, engineering) still require formal qualifications. And for very senior roles, a degree from a prestigious institution still opens doors. But for the majority of knowledge work roles, the shift is real and accelerating." },
    ],
  },
  {
    slug:       "building-learning-habits-that-stick",
    tag:        "Productivity",
    title:      "Building Learning Habits That Actually Stick",
    excerpt:    "Most people set learning goals and abandon them within two weeks. This post covers the habit architecture that makes consistent learning sustainable.",
    author:     "Alex Morgan",
    authorInit: "AM",
    authorRole: "Co-founder & CEO",
    date:       "8 July 2026",
    readTime:   "5 min read",
    color:      "bg-teal-500",
    content: [
      { type: "paragraph", text: "Motivation is a terrible foundation for a learning habit. It's variable, it responds to mood and circumstance, and it reliably runs out before any meaningful skill is built. The people who learn consistently don't rely on motivation — they've built systems that make learning the path of least resistance." },
      { type: "heading", text: "Why most learning habits fail" },
      { type: "paragraph", text: "Most learning habit attempts fail for the same two reasons: the sessions are too long, and the trigger is too vague. 'I'll study for an hour when I have time' fails because the hour is often too daunting to start and 'when I have time' never arrives." },
      { type: "paragraph", text: "The research on habit formation consistently shows that the biggest predictor of habit formation isn't willpower or motivation — it's friction. Habits that are easy to start stick; habits that require effort to initiate don't." },
      { type: "heading", text: "The architecture of a sticky learning habit" },
      { type: "list", items: [
        "Make it small enough to never skip. 15 minutes is better than 60 minutes if the 60 gets skipped. You can always go longer; the goal is to make starting non-negotiable.",
        "Attach it to an existing habit. 'After I make my morning coffee, I do one lecture' is more reliable than 'I'll learn at 7pm'. Implementation intentions — 'when X happens, I do Y' — have a strong evidence base for habit formation.",
        "Reduce setup friction to zero. If your course is bookmarked, your notebook is on your desk, and you know exactly where you left off, you can start within 30 seconds. If you need to hunt for the link, find your notebook, and remember where you were, you won't start.",
        "Track visibly. A chain of Xs on a calendar, a progress bar, a streak counter — visible evidence of your streak creates loss aversion. You don't want to break the chain.",
        "Plan for misses. A missed day is not a failed habit. The rule is: never miss twice. One miss is an accident; two misses is the start of a new habit.",
      ]},
      { type: "heading", text: "The identity lever" },
      { type: "paragraph", text: "The most durable learning habits are built on identity, not goals. 'I want to learn Python' is a goal — it ends when achieved or abandoned. 'I am someone who spends time learning every day' is an identity — it doesn't end." },
      { type: "paragraph", text: "Every time you complete a learning session, you cast a vote for the identity 'I am someone who learns consistently'. Stack enough of those votes, and that's who you become." },
      { type: "callout", label: "Start here", text: "Don't redesign your schedule. Just answer this: what is one existing daily habit you could attach a 10-minute learning session to? Do that for two weeks before adding anything else." },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getRelated(slug: string, count = 3): BlogPost[] {
  return POSTS.filter((p) => p.slug !== slug).slice(0, count);
}
