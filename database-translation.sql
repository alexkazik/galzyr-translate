--
-- PostgreSQL database dump
--

\restrict ZZT5M1VQfhRmio7tnGE0LxVrV8buk4lspCoCQS8AHwGX8fY9C6fqtdeNcmaqIkQ

-- Dumped from database version 18.3 (Homebrew)
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: button; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.button (
    id integer NOT NULL,
    original text NOT NULL,
    translated text
);


--
-- Name: button_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.button ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.button_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rule (
    id bigint NOT NULL,
    stories bigint[] NOT NULL,
    uses bigint NOT NULL,
    original text NOT NULL,
    translated text,
    original_text text,
    translated_text text
);


--
-- Name: rule_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rule ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rule_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: text; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.text (
    id bigint NOT NULL,
    stories bigint[] NOT NULL,
    first_story bigint GENERATED ALWAYS AS (stories[1]) STORED,
    uses bigint NOT NULL,
    original text NOT NULL,
    translated text,
    context text
);


--
-- Name: text_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.text ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.text_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: button; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.button (id, original, translated) FROM stdin;
\.


--
-- Data for Name: rule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rule (id, stories, uses, original, translated, original_text, translated_text) FROM stdin;
\.


--
-- Data for Name: text; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.text (id, stories, uses, original, translated, context) FROM stdin;
\.


--
-- Name: button_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.button_id_seq', 1, false);


--
-- Name: rule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rule_id_seq', 1, false);


--
-- Name: text_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.text_id_seq', 1, false);


--
-- Name: button button_original_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.button
    ADD CONSTRAINT button_original_key UNIQUE (original);


--
-- Name: button button_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.button
    ADD CONSTRAINT button_pkey PRIMARY KEY (id);


--
-- Name: rule rule_original_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule
    ADD CONSTRAINT rule_original_key UNIQUE (original);


--
-- Name: rule rule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule
    ADD CONSTRAINT rule_pkey PRIMARY KEY (id);


--
-- Name: text text_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.text
    ADD CONSTRAINT text_pkey PRIMARY KEY (id);


--
-- Name: text_context_original_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX text_context_original_idx ON public.text USING btree (context, original) NULLS NOT DISTINCT;


--
-- Name: text_original_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX text_original_idx ON public.text USING btree (original);


--
-- PostgreSQL database dump complete
--

\unrestrict ZZT5M1VQfhRmio7tnGE0LxVrV8buk4lspCoCQS8AHwGX8fY9C6fqtdeNcmaqIkQ

