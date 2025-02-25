# irs agent

> your least favorite agent now powered by ai

irs agent is an ai-powered agent that never takes a break. it constantly watches your screen to capture receipts, invoices, and all your tax documents as soon as they appear. by combining cutting-edge ocr, audio transcription, and ui event detection, this agent extracts key details like amounts, currencies, names, and timestamps, creating a complete record of your financial interactions.

<img width="1840" alt="Screenshot 2025-02-23 at 16 37 53" src="https://github.com/user-attachments/assets/00e41c9f-ac98-4ba6-99b2-dc4e735f3a14" />

## current capabilities

- [x] Watches every single transaction you make and stores it in local db
- [x] Local-first
- [ ] Actually does your taxes


## overview

irs agent silently observes your screen, capturing both visual and audio cues in real time using [Screenpipe](https://docs.screenpi.pe) - an open-source screen and audio capture framework. Screenpipe provides 24/7 local media capture capabilities, ensuring all data stays private and secure on your machine. whether you're checking emails, browsing invoices, or finalizing a payment, it identifies and logs financial activities automatically. designed to be obtrusive, it ensures no tax document slips through unnoticed.

## how it works
![image](https://github.com/user-attachments/assets/6b39b487-76f0-44c9-a40f-a4a4c9d6aa26)

## requirements

- screenpipe
- ollama + phi4



## core features

- real-time monitoring that continuously grabs ocr, audio, and ui events
- an automated detector powered by openai models that extracts essential details from your financial documents
- comprehensive logging of every captured event in a secure local database for later review
- fully customizable settings, letting you adjust your openai api key and tailor prompt templates to your specific workflow


1. **installation:**  
   clone the repository and install the dependencies with your preferred package manager. make sure to configure your openai api key and other environment variables as needed.
2. **running the project:**  
   start the next.js development server, and irs agent will immediately begin monitoring your screen and logging tax documents in real time.
3. **reviewing logs:**  
   visit the financial activity tab to view detailed logs of every detected event and review the extracted financial details.

## contributing

contributions are welcome. if you have ideas to enhance irs agent's capabilities or performance, please open an issue or submit a pull request. make sure your code follows the project's style guidelines and includes the necessary tests.

## license

this project is open source.

enjoy the seamless experience of managing your tax documents with irs agent, the ai watchdog that makes sure every receipt and invoice is captured.
