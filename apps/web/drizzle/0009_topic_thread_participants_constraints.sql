DO $$ BEGIN
  ALTER TABLE "topic_threads"
    ADD CONSTRAINT "topic_threads_participants_len_chk"
    CHECK (
      jsonb_typeof("participants") = 'array'
      AND jsonb_array_length("participants") = 2
      AND jsonb_typeof("participants"->0) = 'string'
      AND jsonb_typeof("participants"->1) = 'string'
      AND ("participants"->>0) <> ("participants"->>1)
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "topic_threads"
    VALIDATE CONSTRAINT "topic_threads_participants_len_chk";
EXCEPTION
  WHEN check_violation THEN null;
END $$;
