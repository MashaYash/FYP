# AI-Powered Cross-Allergen Detection System Using Skin Prick Test Report for Detecting Allergens in Allergy Patients

## Project Overview

The AI-Powered Cross-Allergen Detection System is a healthcare-focused application developed to help allergy patients understand possible cross-allergens based on their Skin Prick Test (SPT) reports.

The system analyzes SPT reports, identifies positive allergens and provides information about possible cross-allergens. It also uses a machine learning model to predict additional possible cross-allergens and provides risk levels and explanations for the identified results.

The system also includes an AI-powered chatbot that provides general allergy-related information and support.

This system is developed as a decision-support and information system and does not replace professional medical diagnosis or advice.

## Objectives

The main objectives of the project are:

* To analyze Skin Prick Test reports using AI-based techniques.
* To identify positive allergens from SPT reports.
* To detect possible cross-allergens related to identified allergens.
* To predict additional possible cross-allergens using a machine learning model.
* To provide risk levels for detected cross-allergens.
* To provide explanations for the identified cross-allergens.
* To provide an AI-powered chatbot for allergy-related support.
* To present complex allergy information in a simple and understandable format.
* To maintain user privacy and protect sensitive information.

## Main Features

### Skin Prick Test Report Analyzer

The Report Analyzer allows users to upload their Skin Prick Test reports.

The module is designed to:

* Process uploaded SPT reports.
* Extract relevant information from the reports.
* Identify tested allergens.
* Identify positive allergens.
* Extract relevant test values such as wheal sizes.
* Convert extracted information into structured data.

### Cross-Allergen Detection

The Cross-Allergen Detection module uses the positive allergens identified by the Report Analyzer.

The system retrieves the positive allergens and checks the allergy knowledge base to identify related cross-allergens.

The module provides:

* Identified cross-allergens.
* Related food or allergen information.
* Risk levels.
* Explanations of the possible cross-allergen relationship.

The knowledge base is maintained using an Excel dataset containing allergen and cross-allergen information.

### Machine Learning-Based Prediction

The system includes a machine learning component to predict possible cross-allergens.

The model is used to identify possible relationships between allergens and predict additional cross-allergens that are not directly available in the existing dataset.

The machine learning predictions are provided as recommendations and should be medically verified.

### Risk Level Classification

The detected cross-allergens are categorized into different risk levels:

* Low Risk
* Medium Risk
* High Risk

The system provides an explanation along with the risk level to help users understand the possible significance of the result.

### AI-Powered Chatbot

The system includes an AI-powered chatbot that provides general allergy-related information.

Users can ask questions related to:

* Allergens
* Cross-allergies
* Food allergies
* Skin Prick Test results
* Cross-allergen relationships
* General allergy-related information

The chatbot is intended for informational purposes and does not provide medical diagnoses.

## Technologies Used

### Frontend

* React Native
* Expo
* JavaScript
* TypeScript

### Backend

* Python
* FastAPI
* REST API

### Artificial Intelligence and Machine Learning

* Machine Learning
* Natural Language Processing
* Optical Character Recognition
* AI-based text processing

### Data and Database

* PostgreSQL
* Excel
* JSON

### Development and Deployment

* Docker
* Docker Compose
* Git
* GitHub
* Visual Studio Code

## Project Structure

```text
AllergyGenie-FinalProject/
│
├── frontend/
├── backend/
├── data/
│   └── allergies.xlsx
├── docker-compose.yml
├── README.md
└── ...
```

The folder structure may vary depending on the final implementation.

## System Workflow

The system follows the following general workflow:

1. The user logs into the application.
2. The user uploads a Skin Prick Test report.
3. The Report Analyzer processes the uploaded report.
4. OCR and NLP techniques are used to extract relevant information.
5. Positive allergens are identified from the report.
6. The identified positive allergens are passed to the Cross-Allergen Detection module.
7. The system searches the allergy knowledge base for related cross-allergens.
8. The machine learning model predicts additional possible cross-allergens.
9. Risk levels are assigned to the identified results.
10. The results and explanations are displayed to the user.
11. The user can also use the chatbot for additional allergy-related information.

## Data Privacy and Security

Since the system works with healthcare-related information, privacy and security are important considerations.

The project follows the following principles:

* Collect only the information necessary for the application.
* Avoid storing unnecessary personal information.
* Use secure user authentication.
* De-identify or anonymize SPT reports used for AI processing or research.
* Remove or avoid storing names, addresses, phone numbers and other direct identifiers.
* Protect user information during processing and storage.
* Use AI predictions as recommendations rather than medical decisions.

## Medical Disclaimer

This application is developed as part of an academic Final Year Project.

The results generated by the system are intended for informational and decision-support purposes only. Cross-allergen predictions are not medical diagnoses and should be verified by a qualified healthcare professional.

Users should not change their diet, medication or medical treatment based only on the results generated by this system.

## Project Team

Horizon Campus
Faculty of Information Technology

### Project Title

AI-Powered Cross-Allergen Detection System Using Skin Prick Test Report for Detecting Allergens in Allergy Patients

### Team Members

* K.N.Y. Wimalananda
* W.A.K. Nirmani
* D.I.R. Noragal

### Supervisor

Mr. Thilina Samarasinghe

### Coordinating Supervisor

Ms. Kaushalya Ekanayake

## Project Purpose

This project is developed as part of the Final Year Project at Horizon Campus.

The main purpose of the project is to explore the use of artificial intelligence and machine learning for processing Skin Prick Test reports and providing useful cross-allergen information to support allergy patients and healthcare professionals.
