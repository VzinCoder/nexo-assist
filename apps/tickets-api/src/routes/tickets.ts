import {
  createTicketBodySchema,
  similarBodySchema,
  ticketListQuerySchema,
  ticketParamsSchema,
  type SimilarTicket,
  type Ticket,
  type TicketSummary,
} from "@nexo/shared";
import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "../app";
import { currentEmployee, registerEmployeeContext } from "../plugins/employee-context";
import { AppError } from "../plugins/errors";
import { findTicket, listComments, listTickets } from "../tickets/repository";
import { toTicket, toTicketSummary } from "../tickets/serialize";
import { createTicket, findSimilarTickets } from "../tickets/service";

/** Mesmo erro para inexistente e para chamado de outro funcionário. */
export const ticketNotFound = () => new AppError("not_found", "Chamado não encontrado.");

/** Rotas sob `/tickets`; todas exigem `X-Employee-Id` e só enxergam chamados desse funcionário. */
export function registerTicketRoutes(scope: FastifyInstance, deps: RouteDeps): void {
  const { db, now } = deps;

  void scope.register(
    async (tickets) => {
      registerEmployeeContext(tickets, db);

      tickets.get("/", async (request): Promise<TicketSummary[]> => {
        const { status } = ticketListQuerySchema.parse(request.query);
        const at = now();
        return listTickets(db, currentEmployee(request).id, status).map((row) =>
          toTicketSummary(row, at),
        );
      });

      tickets.post("/", async (request, reply) => {
        const body = createTicketBodySchema.parse(request.body);
        const ticket = createTicket(db, currentEmployee(request).id, body, now());
        return reply.code(201).send(ticket);
      });

      tickets.post("/similar", async (request): Promise<SimilarTicket[]> => {
        const { text } = similarBodySchema.parse(request.body);
        return findSimilarTickets(db, currentEmployee(request).id, text, now());
      });

      tickets.get("/:id", async (request): Promise<Ticket> => {
        const { id } = ticketParamsSchema.parse(request.params);
        const employeeId = currentEmployee(request).id;
        const row = findTicket(db, employeeId, id);
        if (!row) throw ticketNotFound();
        return toTicket(row, listComments(db, employeeId, id), now());
      });
    },
    { prefix: "/tickets" },
  );
}
