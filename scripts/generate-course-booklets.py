#!/usr/bin/env python3
"""Generate structured Learnify course data from the supplied candidate PDFs."""

from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

SOURCE_DIR = Path("/Users/appdev/courses")
OUTPUT = Path("src/db/course-content/course-booklets.generated.json")

COURSES = {
    "AI AGENT COMPLETE COURSE BOOKLET.pdf": {
        "title": "Introduction to AI Agents",
        "slug": "introduction-to-ai-agents",
        "category": {"name": "Artificial Intelligence", "slug": "artificial-intelligence"},
        "shortDescription": "Understand how AI agents reason, use tools and act autonomously, and learn when agentic systems are the right solution for a real problem.",
        "days": 5,
        "requirements": ["No previous AI or programming experience is required", "A computer with internet access", "Time to complete the guided exercises and final assessment"],
    },
    "AI FOR DATA Visualization COMPLETE COURSE BOOKLET.pdf": {
        "title": "AI for Data Visualization",
        "slug": "ai-for-data-visualization",
        "category": {"name": "Data & Analytics", "slug": "data-analytics"},
        "shortDescription": "Use embedded AI agents in Excel, Power BI and Tableau to explore data, create visualisations and communicate trustworthy insights.",
        "days": 5,
        "requirements": ["Basic familiarity with spreadsheets and charts is helpful", "Access to a computer with relevant data tools", "Time to complete demonstrations, exercises and the final assessment"],
    },
    "GENERATIVE AL COMPLETE COURSE BOOKLET.pdf": {
        "title": "Generative AI for Everyone",
        "slug": "generative-ai-for-everyone",
        "category": {"name": "Artificial Intelligence", "slug": "artificial-intelligence"},
        "shortDescription": "Understand how generative AI works, plan valuable projects, evaluate business applications and use the technology responsibly.",
        "days": 5,
        "requirements": ["No previous AI or technical experience is required", "A computer with internet access", "Time to complete the activities and final assessment"],
    },
}

REQUIREMENTS = [
    "No previous professional experience in the subject is required",
    "A notebook or digital note-taking tool",
    "Time to complete the practical exercises and final assessment",
    "Curiosity and a willingness to apply each concept to realistic scenarios",
]


def extract_lines(path: Path) -> list[str]:
    raw = "\n".join((page.extract_text() or "") for page in PdfReader(path).pages)

    lines: list[str] = []
    for line in raw.splitlines():
        clean = re.sub(r"\s+", " ", line).strip()
        if not clean:
            lines.append("")
            continue
        if re.match(r"^\d{2}/\d{2}/\d{4}, \d{2}:\d{2} .+$", clean):
            continue
        if clean == "COMPLETE COURSE BOOKLET":
            continue
        if clean.startswith("https://md2pdf.netlify.app"):
            continue
        lines.append(clean)
    return lines


def find(lines: list[str], pattern: str, start: int = 0) -> int:
    rx = re.compile(pattern, re.I)
    for index in range(start, len(lines)):
        if rx.match(lines[index]):
            return index
    return -1


def compact(lines: list[str]) -> str:
    output: list[str] = []
    blank = False
    for line in lines:
        if not line:
            if output and not blank:
                output.append("")
            blank = True
            continue
        output.append(line)
        blank = False
    return "\n".join(output).strip()


def student_content(lines: list[str]) -> str:
    """Keep learner-facing material while removing facilitator-only directions."""
    kept: list[str] = []
    for line in lines:
        if re.match(r"^Facilitator Notes?:", line, re.I):
            break
        if re.match(r"^Facilitator Script:$", line, re.I):
            continue
        kept.append(line)
    return compact(kept)


def joined_heading(lines: list[str], index: int) -> tuple[str, int]:
    title = lines[index]
    cursor = index + 1
    while title.endswith(("&", "-")) and cursor < len(lines) and lines[cursor]:
        title += " " + lines[cursor]
        cursor += 1
    return title.replace("& the", "& the"), cursor


def description_and_outcomes(lines: list[str], day_one: int) -> tuple[str, list[str]]:
    overview_start = find(lines, r"^Course Overview$") + 1
    facilitator_prep = find(lines, r"^Facilitator Preparation Checklist$", overview_start)
    overview_end = facilitator_prep if facilitator_prep >= 0 else day_one
    overview = compact(lines[overview_start:overview_end])
    learn = find(lines, r"^(What You Will Learn|Learning Objectives)$")
    outcomes: list[str] = []
    if learn >= 0:
        cursor = learn + 1
        while cursor < day_one:
            line = lines[cursor]
            if not line:
                cursor += 1
                continue
            if re.match(r"^(The |Typical |Prerequisites|Certification |Course Materials|Facilitator Preparation|Day 1:)", line):
                break
            if line.lower().startswith("by the end of this"):
                cursor += 1
                continue
            if outcomes and outcomes[-1].endswith((" and", " or", ",")):
                outcomes[-1] += " " + line
            elif len(line) > 12:
                outcomes.append(line)
            cursor += 1
    return overview, outcomes


def make_day_module(lines: list[str], day: int, start: int, end: int) -> dict:
    title, content_start = joined_heading(lines, start)
    numbered: list[int] = []
    for index in range(content_start, end):
        if re.match(rf"^(?:Module )?{day}\.\d+\s*(?:—|-)?\s*", lines[index]):
            numbered.append(index)

    lessons: list[dict] = []
    exercises = find(lines, rf"^Day {day} Exercises$", content_start)
    summary = find(lines, rf"^Day {day} Summary$", content_start)
    boundary = min([value for value in (exercises, summary, end) if value >= 0])
    numbered = [index for index in numbered if index < boundary]

    intro = student_content(lines[content_start : numbered[0] if numbered else boundary])
    if intro:
        lessons.append({
            "title": f"Day {day} learning objectives",
            "durationMinutes": 20,
            "content": intro,
        })

    for position, section_start in enumerate(numbered):
        section_end = numbered[position + 1] if position + 1 < len(numbered) else boundary
        lessons.append({
            "title": re.sub(rf"^(?:Module )?{day}\.\d+\s*(?:—|-)?\s*", "", lines[section_start]),
            "durationMinutes": 55,
            "content": student_content(lines[section_start + 1 : section_end]),
        })

    if exercises >= 0 and exercises < end:
        exercise_end = summary if summary > exercises else end
        lessons.append({
            "title": f"Day {day} practical workshop",
            "durationMinutes": 90,
            "content": compact(lines[exercises + 1 : exercise_end]),
        })

    if summary >= 0 and summary < end:
        lessons.append({
            "title": f"Day {day} summary and knowledge check",
            "durationMinutes": 30,
            "content": compact(lines[summary + 1 : end]),
        })

    return {
        "title": re.sub(r"^Day (\d+):", r"Day \1 —", title),
        "description": f"Complete the Day {day} concepts, guided practice, exercises and knowledge check.",
        "lessons": lessons,
    }


def build_course(filename: str, config: dict) -> dict:
    lines = extract_lines(SOURCE_DIR / filename)
    day_count = config["days"]
    day_starts = [find(lines, rf"^Day {day}:") for day in range(1, day_count + 1)]
    if any(index < 0 for index in day_starts):
        raise RuntimeError(f"Could not locate all {day_count} days in {filename}: {day_starts}")
    final_heading = config.get("assessmentHeading", "Final Assessment")
    final = find(lines, rf"^{re.escape(final_heading)}$", day_starts[-1])
    end_heading = config.get("endHeading", "Assessment Answer Key")
    content_end = find(lines, rf"^{re.escape(end_heading)}$", max(final, day_starts[-1]))
    if final < 0:
        final = content_end if content_end >= 0 else len(lines)
    overview, outcomes = description_and_outcomes(lines, day_starts[0])

    modules = [{
        "title": f"Start Here — Course Orientation & {day_count}-Day Plan",
        "description": f"Understand the course outcomes, learning method and recommended {day_count}-day journey.",
        "lessons": [{
            "title": "Welcome, outcomes and how to use this course",
            "durationMinutes": 30,
            "isFree": True,
            "content": overview,
        }],
    }]
    for day in range(1, day_count + 1):
        end = day_starts[day] if day < day_count else final
        modules.append(make_day_module(lines, day, day_starts[day - 1], end))

    if final < len(lines) and final != content_end:
        assessment_end = content_end if content_end > final else len(lines)
        assessment_content = compact(lines[final + 1 : assessment_end])
        if assessment_content:
            modules.append({
                "title": "Final Assessment",
                "description": f"Demonstrate understanding across the complete {day_count}-day programme.",
                "lessons": [{
                    "title": f"{config['title']} final assessment",
                    "durationMinutes": 90,
                    "content": assessment_content,
                }],
            })

    total_lessons = sum(len(module["lessons"]) for module in modules)
    if not outcomes:
        outcomes = [f"Apply the core concepts and practical methods taught in {config['title']}"]
    outcomes = config.get("whatYouLearn", outcomes)
    outcomes = [re.sub(r"^\d+\.\s*", "", outcome) for outcome in outcomes]

    return {
        **config,
        "sourceFilename": filename,
        "description": overview,
        "requirements": config.get("requirements", REQUIREMENTS),
        "whatYouLearn": outcomes,
        "modules": modules,
        "audit": {"moduleCount": len(modules), "lessonCount": total_lessons},
    }


def main() -> None:
    courses = [build_course(filename, config) for filename, config in COURSES.items()]
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(courses, indent=2, ensure_ascii=False) + "\n")
    for course in courses:
        print(f"{course['title']}: {course['audit']['moduleCount']} modules, {course['audit']['lessonCount']} lessons")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
