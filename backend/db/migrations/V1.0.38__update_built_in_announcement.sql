SET search_path TO pay_transparency;

-- add a 'published_on' date to the built-in announcement
update announcement set published_on = LOCALTIMESTAMP AT TIME ZONE 'UTC' where published_on is null and title = 'Guidance for preparing reports';