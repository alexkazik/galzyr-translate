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
-- Name: deepl; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deepl (
    id integer NOT NULL,
    key text NOT NULL,
    comment text NOT NULL,
    active boolean NOT NULL
);


--
-- Name: deepl_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.deepl ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.deepl_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file (
    filename text NOT NULL,
    last_modified text NOT NULL,
    size bigint NOT NULL,
    important boolean NOT NULL,
    asset boolean NOT NULL,
    with_version boolean NOT NULL,
    audio_format text[] NOT NULL
);


--
-- Data for Name: deepl; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deepl (id, key, comment, active) FROM stdin;
1	your-api-key-here	comment here	t
\.


--
-- Data for Name: file; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.file (filename, last_modified, size, important, asset, with_version, audio_format) FROM stdin;
css/style.css	Wed, 21 Oct 2015 07:28:00 GMT	0	f	f	f	{}
index.html	Wed, 21 Oct 2015 07:28:00 GMT	0	t	f	f	{}
service-worker.js	Wed, 21 Oct 2015 07:28:00 GMT	0	f	f	f	{}
\.


--
-- Name: deepl_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.deepl_id_seq', 1, true);


--
-- Name: deepl deepl_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deepl
    ADD CONSTRAINT deepl_key_key UNIQUE (key);


--
-- Name: deepl deepl_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deepl
    ADD CONSTRAINT deepl_pkey PRIMARY KEY (id);


--
-- Name: file file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file
    ADD CONSTRAINT file_pkey PRIMARY KEY (filename);


--
-- Name: active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX active_idx ON public.deepl USING btree (active) WHERE active;


--
-- PostgreSQL database dump complete
--

\unrestrict ZZT5M1VQfhRmio7tnGE0LxVrV8buk4lspCoCQS8AHwGX8fY9C6fqtdeNcmaqIkQ

