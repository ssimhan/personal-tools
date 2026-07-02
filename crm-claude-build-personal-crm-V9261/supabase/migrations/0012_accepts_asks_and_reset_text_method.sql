-- New "accepts_asks" question on the public contact-update page.
-- true = open to small asks, false = no thanks, null = unanswered.
alter table public.people
  add column if not exists accepts_asks boolean;

-- Wipe every existing text_method value so nobody is "defaulted" to a method
-- they never picked. Going forward, text_method is only set when the contact
-- or the user explicitly chooses Text or WhatsApp on the picker.
update public.people set text_method = null where text_method is not null;
