# Tarefas agendadas do OABase: as duas que a Netlify rodava (e-mails do dia
# e reconciliação de cobranças) e o backup do banco.
#
# Base `postgres:17-alpine` pelo `pg_dump`: ele precisa ser da mesma versão
# principal do servidor (o Supabase está no 17) ou mais nova, senão recusa.
FROM postgres:17-alpine
RUN apk add --no-cache curl rclone age tzdata
COPY crontab /etc/crontabs/root
COPY entrada.sh tarefa.sh backup.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/entrada.sh /usr/local/bin/tarefa.sh /usr/local/bin/backup.sh
ENTRYPOINT ["/usr/local/bin/entrada.sh"]
