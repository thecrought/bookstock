-- Run once in Supabase SQL Editor to enable atomic transfers between bins.
create or replace function public.transfer_stock(p_book_id uuid,p_from_bin text,p_to_bin text,p_quantity integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_from text := upper(trim(p_from_bin)); v_to text := upper(trim(p_to_bin)); v_left integer;
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
 if v_from is null or v_to is null or v_from='' or v_to='' or v_from=v_to then raise exception 'Invalid bins'; end if;
 if not exists(select 1 from public.books where id=p_book_id and owner_id=v_owner) then raise exception 'Book not found'; end if;
 update public.stock set quantity=quantity-p_quantity,updated_at=now()
 where owner_id=v_owner and book_id=p_book_id and bin_code=v_from and quantity>=p_quantity returning quantity into v_left;
 if v_left is null then raise exception 'Insufficient stock'; end if;
 insert into public.stock(owner_id,book_id,bin_code,quantity) values(v_owner,p_book_id,v_to,p_quantity)
 on conflict(owner_id,book_id,bin_code) do update set quantity=public.stock.quantity+p_quantity,updated_at=now();
 insert into public.stock_movements(owner_id,book_id,bin_code,movement_type,quantity_delta)
 values(v_owner,p_book_id,v_from,'adjust',-p_quantity),(v_owner,p_book_id,v_to,'adjust',p_quantity);
end; $$;
revoke all on function public.transfer_stock(uuid,text,text,integer) from public,anon;
grant execute on function public.transfer_stock(uuid,text,text,integer) to authenticated;
