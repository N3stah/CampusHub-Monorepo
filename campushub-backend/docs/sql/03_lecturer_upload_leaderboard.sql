-- Purpose: Admin view — rank lecturers within each department by how many
--          resources they have uploaded.

SELECT
    d.name                              AS department_name,
    d.code                              AS department_code,
    u.id                                AS lecturer_id,
    u.first_name || ' ' || u.last_name  AS lecturer_name,
    u.email,
    COUNT(r.id)                         AS total_uploads,
    SUM(r.file_size)                    AS total_bytes_uploaded,
    SUM(r.download_count)               AS total_downloads
FROM accounts_user u
    INNER JOIN academics_department d ON d.id = u.department_id
    LEFT  JOIN resources_resource   r ON r.uploaded_by_id = u.id
WHERE u.role = 'lecturer'
  AND u.is_active = TRUE
GROUP BY
    d.id, d.name, d.code,
    u.id, u.first_name, u.last_name, u.email
ORDER BY d.name, total_uploads DESC;
