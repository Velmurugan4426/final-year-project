DO $$
BEGIN
    IF to_regclass('interview_session_turns') IS NOT NULL THEN
        ALTER TABLE interview_session_turns
            ADD COLUMN IF NOT EXISTS answer_feedback TEXT;

        ALTER TABLE interview_session_turns
            ADD COLUMN IF NOT EXISTS turn_status VARCHAR(20);

        UPDATE interview_session_turns
        SET turn_status = CASE
            WHEN answer_feedback = 'No speech was detected. The question was skipped.' THEN 'SKIPPED'
            WHEN NULLIF(BTRIM(answer_text), '') IS NOT NULL THEN 'ANSWERED'
            ELSE 'PENDING'
        END
        WHERE turn_status IS NULL;

        ALTER TABLE interview_session_turns
            ALTER COLUMN turn_status SET DEFAULT 'PENDING',
            ALTER COLUMN turn_status SET NOT NULL;
    END IF;
END
$$;
